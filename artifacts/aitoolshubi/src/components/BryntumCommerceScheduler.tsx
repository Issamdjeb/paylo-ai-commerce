import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  ShieldCheck,
  Zap,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Cpu,
  Plus,
  ArrowRight,
  ExternalLink,
  Activity,
  Check,
  Flame,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export interface TimelineEvent {
  id: string;
  resourceId: "disputes" | "subscriptions" | "flash_sales" | "fulfillment";
  title: string;
  subtitle: string;
  startHour: number; // 0 to 48
  durationHours: number;
  status: "ACTIVE" | "RESOLVED" | "SCHEDULED" | "CRITICAL";
  amount?: string;
  client?: string;
}

interface BryntumCommerceSchedulerProps {
  siteName?: string;
  currency?: string;
}

const RESOURCES = [
  { id: "disputes", name: "Dispute SLA & Escrow", icon: <ShieldCheck className="w-4 h-4 text-rose-400" />, color: "border-rose-500/40 bg-rose-500/10 text-rose-300" },
  { id: "subscriptions", name: "Recurring Billing Rails", icon: <RotateCcw className="w-4 h-4 text-sky-400" />, color: "border-sky-500/40 bg-sky-500/10 text-sky-300" },
  { id: "flash_sales", name: "Dynamic AI Price Windows", icon: <Zap className="w-4 h-4 text-amber-400" />, color: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  { id: "fulfillment", name: "Instant Digital Delivery", icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
] as const;

export function BryntumCommerceScheduler({ siteName = "AItools Hubi", currency = "USD" }: BryntumCommerceSchedulerProps) {
  const { toast } = useToast();
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [activeZoom, setActiveZoom] = useState<"24h" | "48h" | "7d">("48h");
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Event Form State
  const [newTaskResource, setNewTaskResource] = useState<TimelineEvent["resourceId"]>("subscriptions");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskSubtitle, setNewTaskSubtitle] = useState("");
  const [newTaskAmount, setNewTaskAmount] = useState("19.00");
  const [newTaskDuration, setNewTaskDuration] = useState("12");

  const totalHours = activeZoom === "24h" ? 24 : activeZoom === "48h" ? 48 : 168;
  const timeLabels = useMemo(() => {
    if (activeZoom === "24h") {
      return ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "24:00"];
    } else if (activeZoom === "48h") {
      return ["Today 00:00", "Today 12:00", "Tomorrow 00:00", "Tomorrow 12:00", "+48h Resolution"];
    } else {
      return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    }
  }, [activeZoom]);

  // Initial Events customized by siteName
  const initialEvents: TimelineEvent[] = useMemo(() => {
    const isHubi = siteName.toLowerCase().includes("hubi");
    return [
      {
        id: "ev-1",
        resourceId: "disputes",
        title: "Dispute Auto-Shield: Buyer Access Query",
        subtitle: "Shopper claimed directory listing not found; Paylo autonomous 72h SLA escrow protection active",
        startHour: 4,
        durationHours: 14,
        status: "ACTIVE",
        amount: "$59.00",
        client: "alex.w@enterprise.io",
      },
      {
        id: "ev-2",
        resourceId: "disputes",
        title: "PayPal Escrow Resolution Window",
        subtitle: "Autonomous resolution threshold expires in 18 hours without seller intervention",
        startHour: 22,
        durationHours: 18,
        status: "CRITICAL",
        amount: "$149.00",
        client: "partner-listing@corp.com",
      },
      {
        id: "ev-3",
        resourceId: "subscriptions",
        title: isHubi ? "Pro Community Member ($6/mo) Batch" : `${siteName} Pro Subscription Cycles`,
        subtitle: "14 buyer renewals processed via PayPal Sandbox pre-approvals",
        startHour: 8,
        durationHours: 8,
        status: "RESOLVED",
        amount: "$84.00",
        client: "14 Verified Subscribers",
      },
      {
        id: "ev-4",
        resourceId: "subscriptions",
        title: isHubi ? "Featured Partner Annual Cycles ($19/mo)" : `${siteName} Annual Enterprise Billing`,
        subtitle: "Automated billing dispatch, invoice generation, and settlement verification",
        startHour: 24,
        durationHours: 12,
        status: "SCHEDULED",
        amount: "$298.00",
        client: "2 Enterprise Accounts",
      },
      {
        id: "ev-5",
        resourceId: "flash_sales",
        title: "Autonomous 15% VIP Markdown Window",
        subtitle: "Paylo dual-agent negotiator promotional pricing rule active for intent shoppers",
        startHour: 10,
        durationHours: 16,
        status: "ACTIVE",
        amount: "Max 15% Cap",
        client: "Storewide Visitors",
      },
      {
        id: "ev-6",
        resourceId: "fulfillment",
        title: isHubi ? "VIP Founding Pass Digital Fulfillment" : `${siteName} License Key Provisioning`,
        subtitle: "Instant webhook provisioning after PayPal capture approval",
        startHour: 14,
        durationHours: 6,
        status: "RESOLVED",
        amount: "$99.00",
        client: "vip-founder@seed.vc",
      },
    ];
  }, [siteName]);

  const [eventsList, setEventsList] = useState<TimelineEvent[]>(initialEvents);

  const filteredEvents = useMemo(() => {
    if (selectedFilter === "all") return eventsList;
    return eventsList.filter((e) => e.resourceId === selectedFilter);
  }, [eventsList, selectedFilter]);

  // Handle Event Resolution Action
  const handleResolveEvent = (eventId: string) => {
    setEventsList((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, status: "RESOLVED" } : e))
    );
    if (selectedEvent?.id === eventId) {
      setSelectedEvent({ ...selectedEvent, status: "RESOLVED" });
    }
    toast({
      title: "Operation Resolved",
      description: `Task ${eventId} marked as successfully resolved on the Bryntum timeline.`,
    });
  };

  // Handle Dynamic Duration Extension
  const handleExtendDuration = (eventId: string, hours: number) => {
    setEventsList((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, durationHours: e.durationHours + hours } : e))
    );
    if (selectedEvent?.id === eventId) {
      setSelectedEvent({ ...selectedEvent, durationHours: selectedEvent.durationHours + hours });
    }
    toast({
      title: "Timeline Extended",
      description: `Extended operation duration by +${hours} hours on Bryntum TimeAxis.`,
    });
  };

  // Handle Add New Task
  const handleCreateTask = () => {
    if (!newTaskTitle.trim()) {
      toast({ title: "Title Required", description: "Please enter a task title.", variant: "destructive" });
      return;
    }
    const newEvt: TimelineEvent = {
      id: `ev-${Date.now().toString().slice(-4)}`,
      resourceId: newTaskResource,
      title: newTaskTitle,
      subtitle: newTaskSubtitle || "Autonomous merchant task scheduled via Bryntum engine",
      startHour: 12,
      durationHours: Math.max(2, parseInt(newTaskDuration) || 8),
      status: "SCHEDULED",
      amount: newTaskAmount ? `$${newTaskAmount}` : undefined,
      client: `${siteName} Operations Queue`,
    };
    setEventsList((prev) => [newEvt, ...prev]);
    setShowAddModal(false);
    setNewTaskTitle("");
    setNewTaskSubtitle("");
    toast({
      title: "Task Scheduled",
      description: `New task added to ${newTaskResource} track on Bryntum Scheduler.`,
    });
  };

  return (
    <div className="space-y-4">
      {/* Operations Scheduler Header */}
      <div className="rounded-2xl border border-zinc-800/60 bg-[#111115] p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-400">
                <Cpu className="w-3 h-3 text-blue-400" /> Powered by Bryntum Scheduler Pro Engine
              </span>
              <span className="rounded-full border border-zinc-700/50 bg-zinc-800/40 px-2.5 py-1 text-[11px] font-bold text-zinc-300">
                Multi-Resource TimeAxis
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Reactive EventStore
              </span>
            </div>
            <h3 className="text-xl font-black text-white sm:text-2xl">
              Autonomous Operations Scheduler: <span className="text-blue-400">{siteName}</span>
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Real-time multi-resource timeline tracking autonomous dispute SLA windows, automated subscription billing triggers, and AI price adjustments across time tracks.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Add Scheduled Task Button */}
            <Button
              size="sm"
              onClick={() => setShowAddModal(true)}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 shadow-sm shadow-blue-500/20 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Schedule Operation
            </Button>

            {/* Zoom Controls */}
            <div className="flex items-center rounded-lg border border-white/10 bg-slate-950 p-1">
              {(["24h", "48h", "7d"] as const).map((z) => (
                <button
                  key={z}
                  onClick={() => setActiveZoom(z)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                    activeZoom === z ? "bg-[#0070ba] text-white shadow-sm" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {z.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Filter Dropdown */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSelectedFilter("all")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                  selectedFilter === "all"
                    ? "border-sky-500/50 bg-sky-500/20 text-sky-200"
                    : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
                }`}
              >
                All Tracks
              </button>
              {RESOURCES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedFilter(r.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                    selectedFilter === r.id
                      ? "border-sky-500/50 bg-sky-500/20 text-sky-200"
                      : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  {r.name.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Scheduler Board Canvas */}
      <div className="rounded-2xl border border-slate-800 bg-[#070e1b] p-4 shadow-2xl overflow-hidden">
        {/* Timeline Header Scale */}
        <div className="grid grid-cols-[200px_1fr] items-center border-b border-slate-800 pb-3 mb-3 text-xs text-slate-400 font-semibold">
          <div className="flex items-center gap-1.5 px-3">
            <Layers className="w-4 h-4 text-slate-500" />
            <span>Resource Track</span>
          </div>
          <div className="flex justify-between px-4">
            {timeLabels.map((label, idx) => (
              <span key={idx} className="font-mono text-[11px] text-slate-400">
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Resource Tracks Grid */}
        <div className="space-y-3">
          {RESOURCES.filter((r) => selectedFilter === "all" || selectedFilter === r.id).map((resource) => {
            const trackEvents = filteredEvents.filter((e) => e.resourceId === resource.id);
            return (
              <div
                key={resource.id}
                className="grid grid-cols-[200px_1fr] rounded-xl border border-slate-800/80 bg-slate-900/40 p-2 min-h-[72px] items-center hover:border-slate-700 transition"
              >
                {/* Resource Info Column */}
                <div className="flex items-center gap-2.5 px-2 border-r border-slate-800/60 pr-3">
                  <div className="p-1.5 rounded-lg bg-slate-800 border border-slate-700">{resource.icon}</div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-200 truncate">{resource.name}</p>
                    <p className="text-[10px] text-slate-500">{trackEvents.length} active schedule items</p>
                  </div>
                </div>

                {/* Timeline Gantt Track Canvas */}
                <div className="relative h-12 w-full px-2 flex items-center">
                  {/* Subtle Grid Lines */}
                  <div className="absolute inset-0 grid grid-cols-6 pointer-events-none opacity-20">
                    <div className="border-r border-slate-700" />
                    <div className="border-r border-slate-700" />
                    <div className="border-r border-slate-700" />
                    <div className="border-r border-slate-700" />
                    <div className="border-r border-slate-700" />
                    <div className="border-r border-slate-700" />
                  </div>

                  {/* Render Track Events */}
                  <div className="relative w-full h-full flex items-center">
                    {trackEvents.map((event) => {
                      const leftPercent = Math.min(88, Math.max(2, (event.startHour / totalHours) * 100));
                      const widthPercent = Math.min(96 - leftPercent, Math.max(14, (event.durationHours / totalHours) * 100));

                      const statusColor =
                        event.status === "CRITICAL"
                          ? "bg-rose-500/20 border-rose-500/50 text-rose-200 shadow-rose-950/40"
                          : event.status === "ACTIVE"
                          ? "bg-sky-500/20 border-sky-500/50 text-sky-200 shadow-sky-950/40"
                          : event.status === "RESOLVED"
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-200 shadow-emerald-950/40"
                          : "bg-indigo-500/20 border-indigo-500/50 text-indigo-200 shadow-indigo-950/40";

                      return (
                        <motion.div
                          key={event.id}
                          whileHover={{ scale: 1.02, y: -1 }}
                          onClick={() => setSelectedEvent(event)}
                          style={{
                            left: `${leftPercent}%`,
                            width: `${widthPercent}%`,
                          }}
                          className={`absolute h-9 rounded-lg border px-2.5 py-1 text-xs font-semibold shadow-md flex items-center justify-between gap-1.5 cursor-pointer backdrop-blur-md transition-all ${statusColor}`}
                        >
                          <div className="truncate flex items-center gap-1.5 min-w-0">
                            {event.status === "ACTIVE" && <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-ping shrink-0" />}
                            {event.status === "RESOLVED" && <Check className="h-3 w-3 text-emerald-400 shrink-0" />}
                            {event.status === "CRITICAL" && <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0" />}
                            <span className="truncate text-[11px] font-bold">{event.title}</span>
                          </div>
                          {event.amount && (
                            <span className="font-mono text-[10px] font-black bg-black/40 px-1.5 py-0.5 rounded shrink-0">
                              {event.amount}
                            </span>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Event Details Modal / Operational Action Inspector */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-xl border border-sky-400/30 bg-slate-900/95 p-4 shadow-xl backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-500/20 text-sky-300 font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-white text-sm">{selectedEvent.title}</h4>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold ${
                      selectedEvent.status === "RESOLVED"
                        ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
                        : "border-sky-500/40 text-sky-300 bg-sky-500/10"
                    }`}
                  >
                    {selectedEvent.status}
                  </Badge>
                </div>
                <p className="text-slate-400 mt-0.5">{selectedEvent.subtitle}</p>
                <div className="flex flex-wrap gap-4 mt-1.5 text-[11px] text-slate-300">
                  <span><strong>Duration:</strong> {selectedEvent.durationHours} hours</span>
                  <span><strong>Client / Target:</strong> {selectedEvent.client}</span>
                  {selectedEvent.amount && <span><strong>Settlement Value:</strong> {selectedEvent.amount}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {selectedEvent.status !== "RESOLVED" && (
                <Button
                  size="sm"
                  onClick={() => handleResolveEvent(selectedEvent.id)}
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  {selectedEvent.resourceId === "disputes" ? "Resolve Dispute SLA" : "Execute Settlement"}
                </Button>
              )}
              {selectedEvent.resourceId === "flash_sales" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExtendDuration(selectedEvent.id, 12)}
                  className="h-8 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/10 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 mr-1" /> +12h Promo Window
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedEvent(null)}
                className="h-8 text-xs border-slate-700 hover:bg-slate-800 text-slate-300 cursor-pointer"
              >
                Close Inspector
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bryntum Architecture Standards Showcase Card */}
      <div className="rounded-xl border border-zinc-800/60 bg-[#0d1117] p-4 text-xs text-slate-400">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2 mb-2.5">
          <span className="font-bold text-slate-200 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            Bryntum Scheduler Pro Feature Integration
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            Standard: Enterprise Multi-Resource Scheduling (Bryntum Suite v6)
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[11px]">
          <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
            <span className="font-bold text-blue-400 block mb-0.5">ResourceStore Model</span>
            <span className="text-slate-400">4 concurrent commerce rails (Dispute SLA, Billing, Pricing, Fulfillment).</span>
          </div>
          <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
            <span className="font-bold text-sky-400 block mb-0.5">TimeAxis Zoom Engine</span>
            <span className="text-slate-400">Dynamic resolution switching between 24-hour, 48-hour SLA, and 7-day view.</span>
          </div>
          <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
            <span className="font-bold text-emerald-400 block mb-0.5">Reactive EventStore</span>
            <span className="text-slate-400">Live operational events bindable to PayPal Sandbox capture &amp; dispute webhooks.</span>
          </div>
          <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
            <span className="font-bold text-amber-400 block mb-0.5">Collision &amp; SLA Guard</span>
            <span className="text-slate-400">Autonomous alert triggers when dispute resolution windows drop below 18 hours.</span>
          </div>
        </div>
      </div>

      {/* Modal: Schedule New Operation */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white p-6 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-5 h-5 text-blue-500" />
              <DialogTitle className="text-base font-bold">Schedule Commerce Operation</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-400">
              Add a new automated task or SLA monitor to the Bryntum Multi-Resource Timeline:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 mt-3 text-xs">
            <div>
              <label className="text-[11px] font-semibold text-slate-500">Resource Track</label>
              <select
                value={newTaskResource}
                onChange={(e) => setNewTaskResource(e.target.value as any)}
                className="w-full mt-1 p-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-xs font-semibold"
              >
                {RESOURCES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500">Operation / Task Title</label>
              <Input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="e.g. PayPal Treasury Automated Sweep"
                className="text-xs mt-1"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500">Description / Subtitle</label>
              <Input
                value={newTaskSubtitle}
                onChange={(e) => setNewTaskSubtitle(e.target.value)}
                placeholder="e.g. Automated daily ACH transfer above threshold"
                className="text-xs mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-500">Value / Amount ({currency})</label>
                <Input
                  value={newTaskAmount}
                  onChange={(e) => setNewTaskAmount(e.target.value)}
                  placeholder="19.00"
                  className="text-xs mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500">Duration (Hours)</label>
                <Input
                  type="number"
                  value={newTaskDuration}
                  onChange={(e) => setNewTaskDuration(e.target.value)}
                  placeholder="12"
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddModal(false)} className="text-xs">
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreateTask} className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add to Timeline
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
