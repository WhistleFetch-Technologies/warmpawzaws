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
import { useRouter } from "next/navigation";

// Types
interface SupportAgent {
  id: string;
  staffId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  staffRole: string;
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
  canHandleSupport: boolean;
}

const BRAND_ORANGE = "#FF8C42";

export default function SupportSettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"agents" | "sla" | "categories" | "escalation">("agents");
  const [loading, setLoading] = useState(true);
  
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
        loadSLAConfigs(),
        loadCategories(),
        loadEscalationRules(),
        loadStaffList(),
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
        specialties: editingAgent.specialties || ["general"],
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
                    <p className="text-sm text-gray-500">Configure agents, SLA, categories, and escalation rules</p>
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
                { id: "sla", label: "SLA Configuration", icon: Timer, count: slaConfigs.length },
                { id: "categories", label: "Categories", icon: Tag, count: categories.length },
                { id: "escalation", label: "Escalation Rules", icon: ArrowUpRight, count: escalationRules.length },
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
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab.id ? "bg-white/20" : "bg-white"
                  }`}>
                    {tab.count}
                  </span>
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
                <h2 className="text-lg font-semibold text-gray-900">Support Agents</h2>
                <Button
                  onClick={() => {
                    setEditingAgent({});
                    setShowAgentModal(true);
                  }}
                  className="bg-[#FF8C42] hover:bg-[#E07830] text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Agent
                </Button>
              </div>

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
                          <p className="text-xs text-gray-500 capitalize">{agent.role}</p>
                        </div>
                      </div>
                      <Badge className={`${
                        agent.availabilityStatus === "online" 
                          ? "bg-green-100 text-green-700" 
                          : agent.availabilityStatus === "busy"
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
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Staff Member *</label>
                <Select
                  value={editingAgent?.staffId || ""}
                  onValueChange={(value: string) => setEditingAgent({ ...editingAgent, staffId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staffList.filter(s => !s.canHandleSupport || s.id === editingAgent?.staffId).map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        {staff.name} ({staff.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingCategory({ ...editingCategory, description: e.target.value })}
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
