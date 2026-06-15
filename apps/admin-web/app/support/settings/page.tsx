"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Clock,
  Tag,
  ArrowUpRight,
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  RefreshCw,
  Headphones,
  Shield,
  Timer,
  AlertTriangle,
  ChevronLeft,
  Mail,
  Phone,
  CheckCircle,
  FileText,
  GitBranch,
  Bell,
} from "lucide-react";
import {
  Button,
  Card,
  Badge,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from "@warmpawz/ui";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { SavedRepliesSettingsTab } from "@/components/admin/support/SavedRepliesSettingsTab";
import { useRouter } from "next/navigation";

// Types
interface SupportAgent {
  id: string;
  staffId: string;
  userId?: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  staffRole: string;
  roleDisplayNames?: string;
  maxConcurrentTickets: number;
  specialties: string[];
  availabilityStatus: string;
  activeTickets: number;
  isActive: boolean;
}

interface SLAConfig {
  id: string;
  name: string;
  priority: string;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  escalationAfterMinutes: number;
  isActive: boolean;
}

interface Category {
  id: string;
  name: string;
  description: string;
  defaultPriority: string;
  autoAssignTo: string;
  autoAssignName: string;
  displayOrder: number;
  isActive: boolean;
}

interface EscalationRule {
  id: string;
  name: string;
  triggerType: string;
  triggerValue: number;
  priorityFilter: string;
  categoryFilter: string;
  escalateTo: string;
  escalateToName: string;
  newPriority: string;
  notifyEmail: string;
  isActive: boolean;
}

interface Staff {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  roleDisplayNames?: string;
  canHandleSupport: boolean;
}

interface RoutingSettings {
  autoAssignEnabled: boolean;
  assignAfterAiAck: boolean;
  sweeperBatchSize: number;
  fallbackToGeneralSpecialty: boolean;
  lastSweeperRunAt?: string | null;
  lastSweeperAssignedCount?: number;
}

interface NotificationSettings {
  opsInboxEmail: string;
  opsInboxCc: string[];
  opsPhone: string;
  escalationDefaultEmail: string;
  escalationDefaultCc: string[];
  notifyCustomerOnAssign: boolean;
  notifyCustomerOnResolve: boolean;
  notifyAgentOnAssign: boolean;
  notifyAgentOnCustomerReply: boolean;
  notifyOpsOnTicketCreated: boolean;
  notifyOpsOnEscalation: boolean;
  customerSmsOnAgentReplyUrgentOnly: boolean;
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  opsInboxEmail: "",
  opsInboxCc: [],
  opsPhone: "",
  escalationDefaultEmail: "",
  escalationDefaultCc: [],
  notifyCustomerOnAssign: true,
  notifyCustomerOnResolve: true,
  notifyAgentOnAssign: true,
  notifyAgentOnCustomerReply: true,
  notifyOpsOnTicketCreated: true,
  notifyOpsOnEscalation: true,
  customerSmsOnAgentReplyUrgentOnly: false,
};

const AGENT_SPECIALTY_OPTIONS = [
  { value: "general", label: "General" },
  { value: "booking", label: "Booking" },
  { value: "meal_order", label: "Meal order" },
  { value: "billing", label: "Billing / refunds" },
  { value: "account", label: "Account" },
] as const;

const BRAND_ORANGE = "#FF8C42";

export default function SupportSettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "agents" | "routing" | "notifications" | "sla" | "categories" | "escalation" | "saved_replies"
  >("agents");
  const [savedRepliesCount, setSavedRepliesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [routingSettings, setRoutingSettings] = useState<RoutingSettings | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(
    DEFAULT_NOTIFICATION_SETTINGS
  );
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingRouting, setSavingRouting] = useState(false);
  const [runningSweeper, setRunningSweeper] = useState(false);
  
  // Data states
  const [agents, setAgents] = useState<SupportAgent[]>([]);
  const [slaConfigs, setSlaConfigs] = useState<SLAConfig[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [escalationRules, setEscalationRules] = useState<EscalationRule[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  
  // Modal states
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [showSLAModal, setShowSLAModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  
  // Edit states
  const [editingAgent, setEditingAgent] = useState<Partial<SupportAgent> | null>(null);
  const [editingSLA, setEditingSLA] = useState<Partial<SLAConfig> | null>(null);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [editingRule, setEditingRule] = useState<Partial<EscalationRule> | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadAgents(),
        loadRoutingSettings(),
        loadNotificationSettings(),
        loadSLAConfigs(),
        loadCategories(),
        loadEscalationRules(),
        loadStaffList(),
        loadSavedRepliesCount(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadAgents = async () => {
    try {
      const res = await apiClient.get<any>("/support/settings/agents");
      if (res.success) setAgents(res.agents || []);
    } catch (error) {
      console.error("Failed to load agents:", error);
    }
  };

  const loadRoutingSettings = async () => {
    try {
      const res = await apiClient.get<any>("/support/settings/routing");
      if (res.success && res.routing) setRoutingSettings(res.routing);
    } catch (error) {
      console.error("Failed to load routing settings:", error);
    }
  };

  const loadNotificationSettings = async () => {
    try {
      const res = await apiClient.get<any>("/support/settings/notifications");
      if (res.success && res.notifications) {
        setNotificationSettings({
          ...DEFAULT_NOTIFICATION_SETTINGS,
          ...res.notifications,
          opsInboxCc: res.notifications.opsInboxCc || [],
          escalationDefaultCc: res.notifications.escalationDefaultCc || [],
        });
      }
    } catch (error) {
      console.error("Failed to load notification settings:", error);
    }
  };

  const parseCcInput = (raw: string): string[] =>
    raw
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);

  const saveNotificationSettings = async (patch: Partial<NotificationSettings> = {}) => {
    setSavingNotifications(true);
    try {
      const payload = { ...notificationSettings, ...patch };
      const res = await apiClient.put<any>("/support/settings/notifications", payload);
      if (res.success && res.notifications) {
        setNotificationSettings({
          ...DEFAULT_NOTIFICATION_SETTINGS,
          ...res.notifications,
          opsInboxCc: res.notifications.opsInboxCc || [],
          escalationDefaultCc: res.notifications.escalationDefaultCc || [],
        });
        toast.success("Notification settings saved");
      } else {
        toast.error(res.error || "Failed to save notification settings");
      }
    } catch (error) {
      console.error("Failed to save notification settings:", error);
      toast.error("Failed to save notification settings");
    } finally {
      setSavingNotifications(false);
    }
  };

  const saveRoutingSettings = async (patch: Partial<RoutingSettings>) => {
    if (!routingSettings) return;
    setSavingRouting(true);
    try {
      const res = await apiClient.put<any>("/support/settings/routing", {
        autoAssignEnabled: patch.autoAssignEnabled ?? routingSettings.autoAssignEnabled,
        assignAfterAiAck: patch.assignAfterAiAck ?? routingSettings.assignAfterAiAck,
        sweeperBatchSize: patch.sweeperBatchSize ?? routingSettings.sweeperBatchSize,
        fallbackToGeneralSpecialty:
          patch.fallbackToGeneralSpecialty ?? routingSettings.fallbackToGeneralSpecialty,
      });
      if (res.success) {
        setRoutingSettings(res.routing);
        toast.success("Routing settings saved");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to save routing settings");
    } finally {
      setSavingRouting(false);
    }
  };

  const runAssignmentSweeper = async () => {
    setRunningSweeper(true);
    try {
      const res = await apiClient.post<any>("/crm/tickets/auto-assign-batch", {
        force: true,
        limit: Math.min(routingSettings?.sweeperBatchSize ?? 10, 10),
      });
      if (res.success) {
        const msg =
          res.timedOut && (res.routed ?? 0) > 0
            ? `Assigned ${res.routed} ticket(s). More remain — run sweeper again.`
            : res.timedOut
              ? "Time limit reached before assignments completed. Try again."
              : `Assigned ${res.routed ?? 0} ticket(s)`;
        toast.success(msg);
        await loadRoutingSettings();
      }
    } catch (error: any) {
      toast.error(error?.message || "Sweeper failed");
    } finally {
      setRunningSweeper(false);
    }
  };

  const toggleAgentSpecialty = (specialty: string) => {
    if (!editingAgent) return;
    const current = editingAgent.specialties || [];
    const next = current.includes(specialty)
      ? current.filter((s) => s !== specialty)
      : [...current, specialty];
    setEditingAgent({
      ...editingAgent,
      specialties: next.length ? next : ["general"],
    });
  };

  const loadSLAConfigs = async () => {
    try {
      const res = await apiClient.get<any>("/support/settings/sla");
      if (res.success) setSlaConfigs(res.slaConfigs || []);
    } catch (error) {
      console.error("Failed to load SLA configs:", error);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await apiClient.get<any>("/support/settings/categories");
      if (res.success) setCategories(res.categories || []);
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  const loadEscalationRules = async () => {
    try {
      const res = await apiClient.get<any>("/support/settings/escalation-rules");
      if (res.success) setEscalationRules(res.rules || []);
    } catch (error) {
      console.error("Failed to load escalation rules:", error);
    }
  };

  const loadStaffList = async () => {
    try {
      const res = await apiClient.get<any>("/support/settings/staff-list");
      if (res.success) setStaffList(res.staff || []);
    } catch (error) {
      console.error("Failed to load staff list:", error);
    }
  };

  const loadSavedRepliesCount = async () => {
    try {
      const res = await apiClient.get<any>("/support/settings/reply-templates");
      if (res.success) setSavedRepliesCount((res.templates || []).length);
    } catch (error) {
      console.error("Failed to load saved replies count:", error);
    }
  };

  // Save handlers
  const saveAgent = async () => {
    if (!editingAgent?.staffId) {
      toast.error("Please select a staff member");
      return;
    }

    try {
      const res = await apiClient.post<any>("/support/settings/agents", {
        staffId: editingAgent.staffId,
        role: editingAgent.role || "agent",
        maxConcurrentTickets: editingAgent.maxConcurrentTickets || 10,
        specialties: editingAgent.specialties?.length ? editingAgent.specialties : ["general"],
        availabilityStatus: editingAgent.availabilityStatus || "available",
      });

      if (res.success) {
        toast.success(res.message || "Agent saved");
        setShowAgentModal(false);
        setEditingAgent(null);
        loadAgents();
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to save agent");
    }
  };

  const deleteAgent = async (agentId: string) => {
    if (!confirm("Are you sure you want to remove this agent?")) return;

    try {
      const res = await apiClient.delete<any>(`/support/settings/agents/${agentId}`);
      if (res.success) {
        toast.success("Agent removed");
        loadAgents();
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to remove agent");
    }
  };

  const saveSLA = async () => {
    if (!editingSLA?.priority || !editingSLA?.firstResponseMinutes || !editingSLA?.resolutionMinutes) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const res = await apiClient.post<any>("/support/settings/sla", editingSLA);
      if (res.success) {
        toast.success(res.message || "SLA saved");
        setShowSLAModal(false);
        setEditingSLA(null);
        loadSLAConfigs();
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to save SLA");
    }
  };

  const saveCategory = async () => {
    if (!editingCategory?.name) {
      toast.error("Please enter a category name");
      return;
    }

    try {
      const res = await apiClient.post<any>("/support/settings/categories", editingCategory);
      if (res.success) {
        toast.success(res.message || "Category saved");
        setShowCategoryModal(false);
        setEditingCategory(null);
        loadCategories();
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to save category");
    }
  };

  const saveRule = async () => {
    if (!editingRule?.name || !editingRule?.triggerType || editingRule?.triggerValue === undefined) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const res = await apiClient.post<any>("/support/settings/escalation-rules", editingRule);
      if (res.success) {
        toast.success(res.message || "Rule saved");
        setShowRuleModal(false);
        setEditingRule(null);
        loadEscalationRules();
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to save rule");
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm("Are you sure you want to delete this rule?")) return;

    try {
      const res = await apiClient.delete<any>(`/support/settings/escalation-rules/${ruleId}`);
      if (res.success) {
        toast.success("Rule deleted");
        loadEscalationRules();
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete rule");
    }
  };

  const formatMinutes = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-700 border-red-200";
      case "high": return "bg-orange-100 text-orange-700 border-orange-200";
      case "medium": return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "low": return "bg-green-100 text-green-700 border-green-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading Support Settings...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/support")}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#FF8C42] to-[#E07830] shadow-lg">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Support Settings</h1>
                    <p className="text-sm text-gray-500">
                      Configure agents, routing, notifications, SLA, categories, escalation rules, and saved replies
                    </p>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadAllData}
                className="border-gray-200"
              >
                <RefreshCw className={`w-4 h-4 mr-2`} />
                Refresh
              </Button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
              {[
                { id: "agents", label: "Support Agents", icon: Users, count: agents.length },
                { id: "routing", label: "Auto Routing", icon: GitBranch, count: null },
                { id: "notifications", label: "Notifications", icon: Bell, count: null },
                { id: "sla", label: "SLA Configuration", icon: Timer, count: slaConfigs.length },
                { id: "categories", label: "Categories", icon: Tag, count: categories.length },
                { id: "escalation", label: "Escalation Rules", icon: ArrowUpRight, count: escalationRules.length },
                { id: "saved_replies", label: "Saved Replies", icon: FileText, count: savedRepliesCount },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-[#FF8C42] text-white shadow-md"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count != null && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab.id ? "bg-white/20" : "bg-white"
                  }`}>
                    {tab.count}
                  </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Agents Tab */}
          {activeTab === "agents" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Support Agents</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Add users with support-related RBAC roles as support agents
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setEditingAgent({ specialties: ["general"], availabilityStatus: "available" });
                    setShowAgentModal(true);
                  }}
                  className="bg-[#FF8C42] hover:bg-[#E07830] text-white"
                  disabled={staffList.length === 0}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Agent
                </Button>
              </div>
              {staffList.length === 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-orange-900">No users with support roles available</p>
                      <p className="text-xs text-orange-700 mt-1">
                        To add support agents, first assign support-related RBAC roles (e.g. admin, Support Admin /
                        support_admin, support_agent, support) to users in <strong>Role & User Management</strong>.
                        Then return here to add them as agents.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents.map((agent) => (
                  <Card key={agent.id} className="p-5 border border-gray-200 hover:border-[#FF8C42]/30 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF8C42] to-[#E07830] flex items-center justify-center">
                          <Headphones className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">{agent.name}</h3>
                          <p className="text-xs text-gray-500 capitalize">
                            {agent.roleDisplayNames || agent.staffRole || agent.role}
                          </p>
                        </div>
                      </div>
                      <Badge className={`${
                        agent.availabilityStatus === "available"
                          ? "bg-green-100 text-green-700"
                          : agent.availabilityStatus === "away"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-500"
                      }`}>
                        {agent.availabilityStatus || "offline"}
                      </Badge>
                    </div>

                    <div className="space-y-2 mb-4">
                      {agent.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Mail className="w-4 h-4" />
                          <span>{agent.email}</span>
                        </div>
                      )}
                      {agent.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Phone className="w-4 h-4" />
                          <span>{agent.phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1 mb-4">
                      {agent.specialties?.map((specialty) => (
                        <Badge key={specialty} variant="outline" className="text-xs">
                          {specialty}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div className="text-sm">
                        <span className="text-gray-500">Active: </span>
                        <span className="font-semibold text-[#FF8C42]">{agent.activeTickets}</span>
                        <span className="text-gray-400"> / {agent.maxConcurrentTickets}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingAgent(agent);
                            setShowAgentModal(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteAgent(agent.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}

                {agents.length === 0 && (
                  <div className="col-span-full text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                      <Users className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-medium">No agents configured</p>
                    <p className="text-sm text-gray-400 mt-1">Add support agents to handle tickets</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Routing Tab */}
          {activeTab === "routing" && !routingSettings && (
            <div className="text-sm text-gray-500 py-8">Loading routing settings…</div>
          )}

          {activeTab === "routing" && routingSettings && (
            <div className="space-y-4 max-w-2xl">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Round-robin auto-assignment</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Automatically assign tickets to agents by specialty pool after AI acknowledgement.
                </p>
              </div>

              <Card className="p-5 border border-gray-200 space-y-5">
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Enable auto-assign</p>
                    <p className="text-xs text-gray-500">When off, only manual Auto route assigns tickets.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={routingSettings.autoAssignEnabled}
                    disabled={savingRouting}
                    onChange={(e) => void saveRoutingSettings({ autoAssignEnabled: e.target.checked })}
                    className="h-5 w-5 rounded border-gray-300 text-[#FF8C42] focus:ring-[#FF8C42]"
                  />
                </label>

                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Assign after AI acknowledgement</p>
                    <p className="text-xs text-gray-500">Trigger round-robin when ticket reaches Awaiting Assignment.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={routingSettings.assignAfterAiAck}
                    disabled={savingRouting || !routingSettings.autoAssignEnabled}
                    onChange={(e) => void saveRoutingSettings({ assignAfterAiAck: e.target.checked })}
                    className="h-5 w-5 rounded border-gray-300 text-[#FF8C42] focus:ring-[#FF8C42]"
                  />
                </label>

                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Fallback to general specialty</p>
                    <p className="text-xs text-gray-500">
                      If no agent matches the ticket pool, try agents with the general specialty.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={routingSettings.fallbackToGeneralSpecialty}
                    disabled={savingRouting}
                    onChange={(e) =>
                      void saveRoutingSettings({ fallbackToGeneralSpecialty: e.target.checked })
                    }
                    className="h-5 w-5 rounded border-gray-300 text-[#FF8C42] focus:ring-[#FF8C42]"
                  />
                </label>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                    Sweeper batch size
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={routingSettings.sweeperBatchSize}
                    disabled={savingRouting}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const n = parseInt(e.target.value, 10);
                      if (Number.isFinite(n)) {
                        setRoutingSettings({ ...routingSettings, sweeperBatchSize: n });
                      }
                    }}
                    onBlur={() => void saveRoutingSettings({})}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Max unassigned tickets processed per sweeper run (cron every 2–5 min).
                  </p>
                </div>

                {routingSettings.lastSweeperRunAt && (
                  <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">
                    Last sweeper: {new Date(routingSettings.lastSweeperRunAt).toLocaleString()} — assigned{" "}
                    {routingSettings.lastSweeperAssignedCount ?? 0} ticket(s)
                  </p>
                )}

                <Button
                  type="button"
                  variant="outline"
                  disabled={runningSweeper}
                  onClick={() => void runAssignmentSweeper()}
                  className="w-full sm:w-auto"
                >
                  {runningSweeper ? "Running sweeper…" : "Run assignment sweeper now"}
                </Button>
              </Card>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Notification Settings</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Configure ops inbox, escalation email defaults, and audience toggles
                </p>
              </div>

              <Card className="p-5 border border-gray-200 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="w-5 h-5 text-[#FF8C42]" />
                  <h3 className="font-semibold text-gray-900">Ops inbox</h3>
                </div>
                <p className="text-xs text-gray-500">
                  Receives new ticket alerts and backlog notifications.
                </p>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Primary email</label>
                  <Input
                    type="email"
                    value={notificationSettings.opsInboxEmail}
                    disabled={savingNotifications}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNotificationSettings({ ...notificationSettings, opsInboxEmail: e.target.value })
                    }
                    placeholder="support@warmpawz.com"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">CC (comma-separated)</label>
                  <Input
                    value={notificationSettings.opsInboxCc.join(", ")}
                    disabled={savingNotifications}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        opsInboxCc: parseCcInput(e.target.value),
                      })
                    }
                    placeholder="ops-lead@warmpawz.com"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Ops phone (SMS alerts)</label>
                  <Input
                    value={notificationSettings.opsPhone}
                    disabled={savingNotifications}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNotificationSettings({ ...notificationSettings, opsPhone: e.target.value })
                    }
                    placeholder="+91..."
                  />
                </div>
              </Card>

              <Card className="p-5 border border-gray-200 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowUpRight className="w-5 h-5 text-red-600" />
                  <h3 className="font-semibold text-gray-900">Escalation defaults</h3>
                </div>
                <p className="text-xs text-gray-500">
                  Used when an escalation rule has no Notify Email set.
                </p>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Default escalation email</label>
                  <Input
                    type="email"
                    value={notificationSettings.escalationDefaultEmail}
                    disabled={savingNotifications}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        escalationDefaultEmail: e.target.value,
                      })
                    }
                    placeholder="escalations@warmpawz.com"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Escalation CC</label>
                  <Input
                    value={notificationSettings.escalationDefaultCc.join(", ")}
                    disabled={savingNotifications}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        escalationDefaultCc: parseCcInput(e.target.value),
                      })
                    }
                    placeholder="manager@warmpawz.com"
                  />
                </div>
              </Card>

              <Card className="p-5 border border-gray-200 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Bell className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">Channel toggles</h3>
                </div>
                {[
                  {
                    key: "notifyOpsOnTicketCreated" as const,
                    title: "Ops email on new ticket",
                    desc: "Send email to ops inbox when a ticket is created.",
                  },
                  {
                    key: "notifyOpsOnEscalation" as const,
                    title: "Ops email on escalation",
                    desc: "Send escalation email (manual or rule-based).",
                  },
                  {
                    key: "notifyAgentOnAssign" as const,
                    title: "Agent alert on assign",
                    desc: "In-app and email when a ticket is assigned to an agent.",
                  },
                  {
                    key: "notifyAgentOnCustomerReply" as const,
                    title: "Agent alert on customer reply",
                    desc: "Notify assigned agent when customer sends a message.",
                  },
                  {
                    key: "notifyCustomerOnAssign" as const,
                    title: "Customer SMS on assign",
                    desc: "SMS when an agent is assigned to their ticket.",
                  },
                  {
                    key: "notifyCustomerOnResolve" as const,
                    title: "Customer SMS on resolve/close",
                    desc: "SMS when ticket is resolved or closed.",
                  },
                  {
                    key: "customerSmsOnAgentReplyUrgentOnly" as const,
                    title: "Agent reply SMS — urgent/high only",
                    desc: "Limit customer SMS on agent replies to urgent and high priority tickets.",
                  },
                ].map((toggle) => (
                  <label key={toggle.key} className="flex items-center justify-between gap-4 cursor-pointer py-1">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{toggle.title}</p>
                      <p className="text-xs text-gray-500">{toggle.desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationSettings[toggle.key]}
                      disabled={savingNotifications}
                      onChange={(e) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          [toggle.key]: e.target.checked,
                        })
                      }
                      className="h-5 w-5 rounded border-gray-300 text-[#FF8C42] focus:ring-[#FF8C42]"
                    />
                  </label>
                ))}
              </Card>

              <Button
                onClick={() => void saveNotificationSettings()}
                disabled={savingNotifications}
                className="bg-[#FF8C42] hover:bg-[#E07830] text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                {savingNotifications ? "Saving…" : "Save notification settings"}
              </Button>
            </div>
          )}

          {/* SLA Tab */}
          {activeTab === "sla" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">SLA Configuration</h2>
                <Button
                  onClick={() => {
                    setEditingSLA({});
                    setShowSLAModal(true);
                  }}
                  className="bg-[#FF8C42] hover:bg-[#E07830] text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add SLA
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {slaConfigs.map((sla) => (
                  <Card key={sla.id} className="p-5 border border-gray-200 hover:border-[#FF8C42]/30 transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-50">
                          <Timer className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">{sla.name}</h3>
                          <Badge className={`${getPriorityColor(sla.priority)} text-xs mt-1`}>
                            {sla.priority.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingSLA(sla);
                          setShowSLAModal(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500 mb-1">First Response</p>
                        <p className="text-xl font-bold text-gray-900">{formatMinutes(sla.firstResponseMinutes)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500 mb-1">Resolution</p>
                        <p className="text-xl font-bold text-gray-900">{formatMinutes(sla.resolutionMinutes)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500 mb-1">Escalate After</p>
                        <p className="text-xl font-bold text-gray-900">{sla.escalationAfterMinutes ? formatMinutes(sla.escalationAfterMinutes) : "-"}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Categories Tab */}
          {activeTab === "categories" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Support Categories</h2>
                <Button
                  onClick={() => {
                    setEditingCategory({});
                    setShowCategoryModal(true);
                  }}
                  className="bg-[#FF8C42] hover:bg-[#E07830] text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Category
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((cat) => (
                  <Card key={cat.id} className="p-5 border border-gray-200 hover:border-[#FF8C42]/30 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-purple-50">
                          <Tag className="w-4 h-4 text-purple-600" />
                        </div>
                        <h3 className="font-bold text-gray-900 capitalize">{cat.name}</h3>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingCategory(cat);
                          setShowCategoryModal(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {cat.description && (
                      <p className="text-sm text-gray-500 mb-3">{cat.description}</p>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <Badge className={`${getPriorityColor(cat.defaultPriority)} text-xs`}>
                        {cat.defaultPriority} priority
                      </Badge>
                      {cat.autoAssignName && (
                        <span className="text-xs text-gray-400">
                          Auto-assign: {cat.autoAssignName}
                        </span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {activeTab === "saved_replies" && <SavedRepliesSettingsTab />}

          {/* Escalation Rules Tab */}
          {activeTab === "escalation" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Escalation Rules</h2>
                <Button
                  onClick={() => {
                    setEditingRule({});
                    setShowRuleModal(true);
                  }}
                  className="bg-[#FF8C42] hover:bg-[#E07830] text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Rule
                </Button>
              </div>

              <div className="space-y-3">
                {escalationRules.map((rule) => (
                  <Card key={rule.id} className="p-4 border border-gray-200 hover:border-[#FF8C42]/30 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-red-50">
                          <ArrowUpRight className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">{rule.name}</h3>
                          <p className="text-sm text-gray-500">
                            Trigger: After <span className="font-semibold">{rule.triggerValue}</span> {rule.triggerType === "minutes_no_response" ? "minutes without response" : rule.triggerType}
                            {rule.priorityFilter && <span> (for {rule.priorityFilter} priority)</span>}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          {rule.newPriority && (
                            <Badge className={`${getPriorityColor(rule.newPriority)} text-xs mb-1`}>
                              Set to {rule.newPriority}
                            </Badge>
                          )}
                          {rule.escalateToName && (
                            <p className="text-xs text-gray-500">Assign to: {rule.escalateToName}</p>
                          )}
                          {rule.notifyEmail && (
                            <p className="text-xs text-gray-400">Notify: {rule.notifyEmail}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingRule(rule);
                              setShowRuleModal(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteRule(rule.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}

                {escalationRules.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                      <ArrowUpRight className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-medium">No escalation rules configured</p>
                    <p className="text-sm text-gray-400 mt-1">Add rules to auto-escalate tickets based on conditions</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Add/Edit Agent Modal */}
        <Dialog open={showAgentModal} onOpenChange={setShowAgentModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingAgent?.id ? "Edit Agent" : "Add Support Agent"}</DialogTitle>
              <DialogDescription>
                Configure support agent settings
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">User with RBAC Role *</label>
                <Select
                  value={editingAgent?.staffId || ""}
                  onValueChange={(value: string) => setEditingAgent({ ...editingAgent, staffId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user with support role..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staffList.filter(s => !s.canHandleSupport || s.id === editingAgent?.staffId).map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        {staff.name} {staff.roleDisplayNames && `(${staff.roleDisplayNames})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1.5">
                  Only users with support-related RBAC roles (admin, support_admin, support_agent, support, etc.) are shown. 
                  Assign roles in <strong>Role & User Management</strong> first.
                </p>
                {staffList.length === 0 && (
                  <p className="text-xs text-orange-600 mt-1.5">
                    ⚠️ No users with support roles found. Please assign support-related roles in RBAC management first.
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Role</label>
                <Select
                  value={editingAgent?.role || "agent"}
                  onValueChange={(value: string) => setEditingAgent({ ...editingAgent, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Max Concurrent Tickets</label>
                <Input
                  type="number"
                  value={editingAgent?.maxConcurrentTickets || 10}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingAgent({ ...editingAgent, maxConcurrentTickets: parseInt(e.target.value) })}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Availability</label>
                <Select
                  value={editingAgent?.availabilityStatus || "available"}
                  onValueChange={(value: string) =>
                    setEditingAgent({ ...editingAgent, availabilityStatus: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="away">Away</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Specialties</label>
                <p className="text-xs text-gray-500 mb-2">
                  Tickets route to agents whose specialty matches the pool (booking, meal order, billing, etc.).
                </p>
                <div className="flex flex-wrap gap-2">
                  {AGENT_SPECIALTY_OPTIONS.map((opt) => {
                    const selected = (editingAgent?.specialties || []).includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleAgentSpecialty(opt.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          selected
                            ? "bg-[#FF8C42]/15 border-[#FF8C42] text-[#E07830]"
                            : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAgentModal(false)}>Cancel</Button>
              <Button onClick={saveAgent} className="bg-[#FF8C42] hover:bg-[#E07830] text-white">
                <Save className="w-4 h-4 mr-2" />
                Save Agent
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add/Edit SLA Modal */}
        <Dialog open={showSLAModal} onOpenChange={setShowSLAModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingSLA?.id ? "Edit SLA" : "Add SLA Configuration"}</DialogTitle>
              <DialogDescription>
                Set response and resolution time targets
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Name</label>
                <Input
                  value={editingSLA?.name || ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingSLA({ ...editingSLA, name: e.target.value })}
                  placeholder="e.g., Urgent SLA"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Priority *</label>
                <Select
                  value={editingSLA?.priority || ""}
                  onValueChange={(value: string) => setEditingSLA({ ...editingSLA, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">First Response (mins) *</label>
                  <Input
                    type="number"
                    value={editingSLA?.firstResponseMinutes || ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingSLA({ ...editingSLA, firstResponseMinutes: parseInt(e.target.value) })}
                    placeholder="60"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Resolution (mins) *</label>
                  <Input
                    type="number"
                    value={editingSLA?.resolutionMinutes || ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingSLA({ ...editingSLA, resolutionMinutes: parseInt(e.target.value) })}
                    placeholder="480"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Escalate After (mins)</label>
                <Input
                  type="number"
                  value={editingSLA?.escalationAfterMinutes || ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingSLA({ ...editingSLA, escalationAfterMinutes: parseInt(e.target.value) })}
                  placeholder="120"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSLAModal(false)}>Cancel</Button>
              <Button onClick={saveSLA} className="bg-[#FF8C42] hover:bg-[#E07830] text-white">
                <Save className="w-4 h-4 mr-2" />
                Save SLA
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add/Edit Category Modal */}
        <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingCategory?.id ? "Edit Category" : "Add Category"}</DialogTitle>
              <DialogDescription>
                Configure support ticket categories
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Name *</label>
                <Input
                  value={editingCategory?.name || ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  placeholder="e.g., billing"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Description</label>
                <Textarea
                  value={editingCategory?.description || ""}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                  placeholder="Describe this category..."
                  rows={2}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Default Priority</label>
                <Select
                  value={editingCategory?.defaultPriority || "medium"}
                  onValueChange={(value: string) => setEditingCategory({ ...editingCategory, defaultPriority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Auto-assign To</label>
                <Select
                  value={editingCategory?.autoAssignTo || "none"}
                  onValueChange={(value: string) => setEditingCategory({ ...editingCategory, autoAssignTo: value === "none" ? undefined : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No auto-assignment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No auto-assignment</SelectItem>
                    {agents.map((agent) => (
                      <SelectItem key={agent.staffId} value={agent.staffId}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCategoryModal(false)}>Cancel</Button>
              <Button onClick={saveCategory} className="bg-[#FF8C42] hover:bg-[#E07830] text-white">
                <Save className="w-4 h-4 mr-2" />
                Save Category
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add/Edit Escalation Rule Modal */}
        <Dialog open={showRuleModal} onOpenChange={setShowRuleModal}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingRule?.id ? "Edit Rule" : "Add Escalation Rule"}</DialogTitle>
              <DialogDescription>
                Configure automatic ticket escalation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Rule Name *</label>
                <Input
                  value={editingRule?.name || ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingRule({ ...editingRule, name: e.target.value })}
                  placeholder="e.g., Escalate after 30 min no response"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Trigger Type *</label>
                  <Select
                    value={editingRule?.triggerType || ""}
                    onValueChange={(value: string) => setEditingRule({ ...editingRule, triggerType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select trigger..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes_no_response">Minutes without response</SelectItem>
                      <SelectItem value="minutes_unassigned">Minutes unassigned</SelectItem>
                      <SelectItem value="customer_replies">Customer replies count</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Trigger Value *</label>
                  <Input
                    type="number"
                    value={editingRule?.triggerValue || ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingRule({ ...editingRule, triggerValue: parseInt(e.target.value) })}
                    placeholder="30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Filter by Priority</label>
                  <Select
                    value={editingRule?.priorityFilter || "any"}
                    onValueChange={(value: string) => setEditingRule({ ...editingRule, priorityFilter: value === "any" ? undefined : value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any priority</SelectItem>
                      <SelectItem value="urgent">Urgent only</SelectItem>
                      <SelectItem value="high">High only</SelectItem>
                      <SelectItem value="medium">Medium only</SelectItem>
                      <SelectItem value="low">Low only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Set New Priority</label>
                  <Select
                    value={editingRule?.newPriority || "none"}
                    onValueChange={(value: string) => setEditingRule({ ...editingRule, newPriority: value === "none" ? undefined : value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Keep current</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Escalate To (Agent)</label>
                <Select
                  value={editingRule?.escalateTo || "none"}
                  onValueChange={(value: string) => setEditingRule({ ...editingRule, escalateTo: value === "none" ? undefined : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select agent..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No auto-assignment</SelectItem>
                    {agents.filter(a => a.role === "supervisor" || a.role === "manager").map((agent) => (
                      <SelectItem key={agent.staffId} value={agent.staffId}>
                        {agent.name} ({agent.role})
                      </SelectItem>
                    ))}
                    {agents.filter(a => a.role === "agent").map((agent) => (
                      <SelectItem key={agent.staffId} value={agent.staffId}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Notify Email</label>
                <Input
                  type="email"
                  value={editingRule?.notifyEmail || ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingRule({ ...editingRule, notifyEmail: e.target.value })}
                  placeholder="manager@example.com"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave blank to use the Escalation default from the Notifications tab.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRuleModal(false)}>Cancel</Button>
              <Button onClick={saveRule} className="bg-[#FF8C42] hover:bg-[#E07830] text-white">
                <Save className="w-4 h-4 mr-2" />
                Save Rule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
