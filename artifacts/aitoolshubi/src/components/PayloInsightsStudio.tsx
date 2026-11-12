import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertCircle, Bot, Check, CreditCard, Database, Edit3, ExternalLink, Eye, Maximize2, Minimize2, RefreshCw, RotateCcw, ShieldCheck, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { AgStudio, AgStudioProvider } from "ag-studio-react";
import { AgStudioAiModule, createAiHarness, studioTheme, type AgAiEvent, type AgDataSourcesDefinition, type AgLlmAdapter, type AgLlmRequest, type AgLlmResponse, type AgReportState, type AgStudioStateUpdatedEvent, type AgStudioTheme } from "ag-studio";
import { apiFetch } from "@/lib/api-client";

type StudioPayload = {
  site: { id: string; name: string; currency: string; verified: boolean };
  plans: Array<{ id: string; name: string; price: number; currency: string; interval: string; active: boolean }>;
  captures: Array<{ id: string; amount: number; currency: string; product: string; timestamp: string; environment: string; status: string }>;
  interactions: Array<{ type: string; timestamp: string }>;
  summary: { verifiedCaptureCount: number; verifiedVolume: number; interactionCount: number; sampleWindow: string };
  assistant?: { available: boolean; provider?: string; routing?: string; modelCandidates?: string[] };
};

export function formatSiteName(rawId: string): string {
  if (!rawId || rawId.includes("aitoolshubi")) return "AItools Hubi";
  return rawId
    .replace(/-com$|-so$|-app$|-io$|-ai$|-org$/g, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function createInitialPayload(siteId: string): StudioPayload {
  return {
    site: { id: siteId, name: formatSiteName(siteId), currency: "USD", verified: false },
    plans: [
      { id: "community-monthly", name: "Pro Community Member", price: 6, currency: "USD", interval: "monthly", active: true },
      { id: "community-yearly", name: "Pro Community (Annual)", price: 59, currency: "USD", interval: "yearly", active: true },
      { id: "featured-monthly", name: "Featured Partner Listing", price: 19, currency: "USD", interval: "monthly", active: true },
      { id: "featured-yearly", name: "Featured Partner (Annual)", price: 149, currency: "USD", interval: "yearly", active: true },
      { id: "premium-monthly", name: "Premium Partner & Media Package", price: 49, currency: "USD", interval: "monthly", active: true },
      { id: "lifetime-vip", name: "Lifetime VIP Founding Pass", price: 99, currency: "USD", interval: "one-time", active: true },
    ],
    captures: [],
    interactions: [],
    summary: { verifiedCaptureCount: 0, verifiedVolume: 0, interactionCount: 0, sampleWindow: "No verified activity recorded yet" },
    assistant: { available: false, provider: "Checking configuration" },
  };
}

let activeStudioSiteId = "aitoolshubi-com";

const assistantAdapter: AgLlmAdapter = {
  executeTurn(request: AgLlmRequest, options) {
    const responsePromise = apiFetch(`/api/paylo/studio/assistant?siteId=${encodeURIComponent(activeStudioSiteId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request, siteId: activeStudioSiteId }),
      signal: options?.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Paylo assistant request failed.");
      return await response.json() as AgLlmResponse;
    });

    const stream = {
      async *[Symbol.asyncIterator](): AsyncGenerator<AgAiEvent> {
        const response = await responsePromise;
        for (const item of response.output ?? []) {
          if (item.type === "message" && item.kind === "output") {
            const text = item.content.filter((part) => part.type === "text").map((part) => part.type === "text" ? part.text : "").join("");
            if (text) yield { type: "TEXT_MESSAGE_CHUNK", messageId: item.id, role: "assistant", delta: text };
          } else if (item.type === "function_call" && item.kind === "output") {
            yield { type: "TOOL_CALL_CHUNK", toolCallId: item.callId, toolCallName: item.name, delta: item.arguments };
          }
        }
      },
    };

    return { stream, complete: responsePromise };
  },
};

export function PayloInsightsStudio({ siteId = "aitoolshubi-com", onSelectSite }: { siteId?: string; onSelectSite?: (newSiteId: string) => void }) {
  activeStudioSiteId = siteId;
  const currentFallbackName = useMemo(() => formatSiteName(siteId), [siteId]);
  const [payload, setPayload] = useState<StudioPayload>(() => createInitialPayload(siteId));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportInstance, setReportInstance] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [studioMode, setStudioMode] = useState<"edit" | "view">("edit");

  // Sync state immediately when siteId changes
  useEffect(() => {
    activeStudioSiteId = siteId;
    setPayload((prev) => {
      if (prev.site.id === siteId) return prev;
      return createInitialPayload(siteId);
    });
  }, [siteId]);

  const reportStorageKey = useMemo(() => `paylo:ag-studio:report:v11:${siteId}`, [siteId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch(`/api/paylo/studio/data?siteId=${encodeURIComponent(siteId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Paylo could not load the merchant dataset.");
      const data = await response.json() as StudioPayload;
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Paylo could not load the merchant dataset.");
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const effectiveSiteName = payload.site.name || currentFallbackName;

  const data = useMemo(() => ({ sources: [
    {
      id: "overview",
      name: "Paylo overview",
      description: `Server-calculated metrics for ${effectiveSiteName}; verified Sandbox payment values are derived exclusively from completed PayPal captures.`,
      data: [{
        verifiedVolume: payload.summary.verifiedVolume,
        verifiedCaptureCount: payload.summary.verifiedCaptureCount,
        interactionCount: payload.summary.interactionCount,
        planCount: payload.plans.length,
      }],
      fields: [
        { id: "verifiedVolume", name: "Volume (USD)", format: "currencyFormat" as const },
        { id: "verifiedCaptureCount", name: "Captures", format: "integerFormat" as const },
        { id: "interactionCount", name: "Shopper signals", format: "integerFormat" as const },
        { id: "planCount", name: "Catalog plans", format: "integerFormat" as const },
        { id: "protectionRate", name: "Protection rate (%)", format: "integerFormat" as const },
        { id: "conversionRate", name: "Conversion rate (%)", format: "integerFormat" as const },
      ],
    },
    {
      id: "catalog",
      name: `${effectiveSiteName} catalog`,
      description: `Verified subscription plans and pricing for ${effectiveSiteName}.`,
      data: payload.plans.length > 0 ? payload.plans : [
        { id: "community-monthly", name: "Pro Community Member", price: 6, currency: "USD", interval: "monthly", active: true },
        { id: "community-yearly", name: "Pro Community (Annual)", price: 59, currency: "USD", interval: "yearly", active: true },
        { id: "featured-monthly", name: "Featured Partner Listing", price: 19, currency: "USD", interval: "monthly", active: true },
        { id: "featured-yearly", name: "Featured Partner (Annual)", price: 149, currency: "USD", interval: "yearly", active: true },
        { id: "premium-monthly", name: "Premium Partner & Media Package", price: 49, currency: "USD", interval: "monthly", active: true },
        { id: "lifetime-vip", name: "Lifetime VIP Founding Pass", price: 99, currency: "USD", interval: "one-time", active: true },
      ],
      fields: [
        { id: "id", name: "Plan ID", format: "textFormat" as const },
        { id: "name", name: "Plan", format: "textFormat" as const },
        { id: "price", name: "Price", format: "currencyFormat" as const },
        { id: "currency", name: "Currency", format: "textFormat" as const },
        { id: "interval", name: "Billing interval", format: "textFormat" as const },
        { id: "active", name: "Active", format: "booleanFormat" as const },
      ],
    },
    {
      id: "payment_methods",
      name: "PayPal Payment Rails",
      description: "Breakdown of volume by PayPal payment rail.",
      data: [],
      fields: [
        { id: "method", name: "Payment Method", format: "textFormat" as const },
        { id: "volume", name: "Volume (USD)", format: "currencyFormat" as const },
        { id: "count", name: "Transactions", format: "integerFormat" as const },
        { id: "share", name: "Share (%)", format: "integerFormat" as const },
      ],
    },
    {
      id: "verified_captures",
      name: "PayPal Sandbox captures",
      description: "Successful PayPal Sandbox captures for the active merchant.",
      data: payload.captures,
      fields: [
        { id: "id", name: "Capture ID", format: "textFormat" as const },
        { id: "amount", name: "Amount", format: "currencyFormat" as const },
        { id: "currency", name: "Currency", format: "textFormat" as const },
        { id: "product", name: "Plan", format: "textFormat" as const },
        { id: "timestamp", name: "Captured at (UTC)", format: "textFormat" as const },
        { id: "environment", name: "Environment", format: "textFormat" as const },
        { id: "status", name: "PayPal status", format: "textFormat" as const },
      ],
    },
    {
      id: "interactions",
      name: "Shopper interactions",
      description: "Sanitized Paylo interaction events with timestamps.",
      data: payload.interactions,
      fields: [
        { id: "type", name: "Interaction", format: "textFormat" as const },
        { id: "timestamp", name: "Observed at (UTC)", format: "textFormat" as const },
      ],
    },
  ] }) satisfies AgDataSourcesDefinition, [payload, effectiveSiteName]);

  const initialState = useMemo<AgReportState>(() => {
    const widgets: Record<string, any> = {
      // ─── TOP KPI ROW: 4 WIDE TELEMETRY CARDS (No Truncation) ───
      "volume-kpi": {
        type: "value",
        format: {
          title: { text: "Gross Volume (USD)", enabled: true },
          subtitle: { text: "PayPal Sandbox Confirmed", enabled: true },
        },
        dataMapping: { value: [{ id: "overview.verifiedVolume", aggregation: "sum" }] },
      },
      "capture-kpi": {
        type: "value",
        format: {
          title: { text: "Verified Captures", enabled: true },
          subtitle: { text: "Orders API v2 Settlements", enabled: true },
        },
        dataMapping: { value: [{ id: "overview.verifiedCaptureCount", aggregation: "sum" }] },
      },
      "plan-kpi": {
        type: "value",
        format: {
          title: { text: "Active Catalog Plans", enabled: true },
          subtitle: { text: `${effectiveSiteName} Tiers`, enabled: true },
        },
        dataMapping: { value: [{ id: "overview.planCount", aggregation: "sum" }] },
      },
      "interaction-kpi": {
        type: "value",
        format: {
          title: { text: "Shopper Signals", enabled: true },
          subtitle: { text: "Live Telemetry Stream", enabled: true },
        },
        dataMapping: { value: [{ id: "overview.interactionCount", aggregation: "sum" }] },
      },

      // ─── VISUALIZATIONS ROW: INSPIRED BY OFFICIAL PAYPAL DEVELOPER WEBINAR ───
      "catalog-bar": {
        type: "column-chart-grouped",
        format: {
          title: { text: `${effectiveSiteName} Catalog Pricing`, enabled: true },
          subtitle: { text: "Commercial tier prices in USD", enabled: true },
        },
        dataMapping: {
          categoryKey: [{ id: "catalog.name" }],
          valueKey: [{ id: "catalog.price", aggregation: "sum" }],
        },
      },
      "method-donut": {
        type: "donut-chart",
        format: {
          title: { text: "Payments by Method", enabled: true },
          subtitle: { text: "PayPal Wallet, Pay in 4, Debit/Credit Card", enabled: true },
        },
        dataMapping: {
          categoryKey: [{ id: "payment_methods.method" }],
          valueKey: [{ id: "payment_methods.volume", aggregation: "sum" }],
        },
      },

      // ─── INTERACTIVE AG GRID DATA TABLES ROW ───
      "catalog-table": {
        type: "grid",
        format: {
          title: { text: `${effectiveSiteName} Catalog`, enabled: true },
          subtitle: { text: "Subscriptions, annual commitments, and one-time founding passes", enabled: true },
          style: { columnAutoSize: true },
        },
        dataMapping: {
          cols: [
            { id: "catalog.name" },
            { id: "catalog.price" },
            { id: "catalog.currency" },
            { id: "catalog.interval" },
            { id: "catalog.active" },
          ],
        },
      },
      "verified-captures": {
        type: "grid",
        format: {
          title: { text: "PayPal Sandbox Captures Ledger", enabled: true },
          subtitle: { text: "PayPal capture records returned by the API", enabled: true },
          style: { columnAutoSize: true },
        },
        dataMapping: {
          cols: [
            { id: "verified_captures.id" },
            { id: "verified_captures.product" },
            { id: "verified_captures.amount" },
            { id: "verified_captures.currency" },
            { id: "verified_captures.status" },
            { id: "verified_captures.timestamp" },
          ],
        },
      },
      "shopper-signals": {
        type: "grid",
        format: {
          title: { text: "Recent Shopper Activity", enabled: true },
          subtitle: { text: "Catalog view, comparison, and checkout intent events", enabled: true },
          style: { columnAutoSize: true },
        },
        dataMapping: {
          cols: [
            { id: "interactions.timestamp" },
            { id: "interactions.type" },
          ],
        },
      },
    };

    const widgetLayout: Record<string, any> = {
      // 4 Top Value Cards: 6 tracks each across 24 tracks
      "volume-kpi": { xTrack: 0, yTrack: 0, xSpan: 6, ySpan: 5 },
      "capture-kpi": { xTrack: 6, yTrack: 0, xSpan: 6, ySpan: 5 },
      "plan-kpi": { xTrack: 12, yTrack: 0, xSpan: 6, ySpan: 5 },
      "interaction-kpi": { xTrack: 18, yTrack: 0, xSpan: 6, ySpan: 5 },

      // Visualizations: Grouped Bar (14 tracks) + Donut (10 tracks)
      "catalog-bar": { xTrack: 0, yTrack: 5, xSpan: 14, ySpan: 12 },
      "method-donut": { xTrack: 14, yTrack: 5, xSpan: 10, ySpan: 12 },

      // Full Tables: 24 tracks full-width
      "catalog-table": { xTrack: 0, yTrack: 17, xSpan: 24, ySpan: 12 },
      "verified-captures": { xTrack: 0, yTrack: 29, xSpan: 24, ySpan: 12 },
      "shopper-signals": { xTrack: 0, yTrack: 41, xSpan: 24, ySpan: 10 },
    };

    return {
      pages: [{
        id: "merchant-overview",
        layout: {
          height: 1800,
          rowHeight: 32,
          columns: 24,
          pagePadding: 16,
          widgetPadding: 8,
          minWidth: 900,
        },
        widgets,
        widgetLayout,
      }],
      selectedPageId: "merchant-overview",
      panels: {
        filters: { collapsed: true },
        edit: { collapsed: true },
        data: { collapsed: true },
      },
    };
  }, [effectiveSiteName]);

  const theme = useMemo<AgStudioTheme>(() => (studioTheme as AgStudioTheme & {
    withParams: (params: Record<string, unknown>) => AgStudioTheme;
  }).withParams({
    backgroundColor: "#060c17",
    foregroundColor: "#f8fafc",
    accentColor: "#0284c7",
    borderColor: "#1e293b",
    browserColorScheme: "dark",
    studioCanvasBackgroundColor: "#030712",
    studioWidgetBackgroundColor: "#0b1329",
    studioWidgetTitleTextColor: "#ffffff",
    studioWidgetSubtitleTextColor: "#94a3b8",
    studioCanvasGridLineColor: "#0f172a",
    gridAccentColor: "#0284c7",
    gridBrowserColorScheme: "dark",
    gridDataBackgroundColor: "#030712",
    gridOddRowBackgroundColor: "#091024",
    gridHeaderBackgroundColor: "#0f172a",
    gridHeaderTextColor: "#f1f5f9",
    gridCellTextColor: "#f8fafc",
    chartTextColor: "#f8fafc",
    chartSubtleTextColor: "#94a3b8",
    chartAxisLineColor: "#1e293b",
    chartGridLineColor: "#0f172a",
    chartPaletteFills1Color: "#0070ba",
    chartPaletteFills2Color: "#00cf92",
    chartPaletteFills3Color: "#6366f1",
    chartPaletteFills4Color: "#f59e0b",
    chartPaletteFills5Color: "#ec4899",
  }), []);

  const savedInitialState = useMemo<AgReportState>(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(reportStorageKey) || "null");
      if (parsed && Array.isArray(parsed.pages) && typeof parsed.selectedPageId === "string") {
        return parsed as AgReportState;
      }
    } catch { /* Use shipped report */ }
    return initialState;
  }, [initialState, reportInstance, reportStorageKey]);

  const onStateUpdated = useCallback(({ state }: AgStudioStateUpdatedEvent) => {
    try { window.localStorage.setItem(reportStorageKey, JSON.stringify(state)); } catch { /* Ignore */ }
  }, [reportStorageKey]);

  const ai = useCallback(({ api }: { api: any }) => createAiHarness(api, {
    adapter: assistantAdapter,
    promptStarters: [
      { label: "Summarize this catalog", prompt: `Summarize what the current catalog offers, prices, and features show for ${effectiveSiteName}.` },
      { label: "Review checkout funnel", prompt: "Review the available shopper interactions and verified captures. Do not invent conversion rates. Tell me which funnel metrics are supported by the data." },
      { label: "Audit captured revenue", prompt: "Explain the verified PayPal Sandbox captures, total volume, and settlement guarantee." },
    ],
  }), [effectiveSiteName]);

  const resetReport = () => {
    try { window.localStorage.removeItem(reportStorageKey); } catch { /* Ignore */ }
    setReportInstance((value) => value + 1);
  };

  const assistantReady = payload.assistant?.available;

  return (
    <section className="space-y-6 text-slate-100">
      {/* Sleek Enterprise Header */}
      <header className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0c0d12] p-6 shadow-md sm:p-7 transition-colors">
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                <Bot className="h-3 w-3 text-blue-500" /> Paylo Intelligence
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                AG Grid Studio & Copilot
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold text-blue-300">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" /> API connected
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Merchant Intelligence: <span className="text-slate-900 dark:text-white font-black">{effectiveSiteName}</span>
            </h2>
            <p className="max-w-2xl text-xs leading-relaxed text-slate-600 dark:text-zinc-400 sm:text-sm">
              Merchant workspace for <strong className="text-white">{effectiveSiteName}</strong>. Paylo’s copilot answers from the connected catalog and the data returned by this API; payment totals stay empty until PayPal confirms a capture.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            <button
              onClick={resetReport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-400 transition hover:bg-white/10 cursor-pointer"
            >
              Reset Layout
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3.5 text-xs text-rose-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Telemetry Cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Database className="h-4 w-4 text-sky-400" />}
          label="Catalog Plans"
          value={payload.plans.length}
          subtext={`${payload.site.currency} listed offers`}
          badge={`${payload.site.name} Catalog`}
        />
        <MetricCard
          icon={<ShieldCheck className="h-4 w-4 text-blue-400" />}
          label="Verified Captures"
          value={payload.summary.verifiedCaptureCount}
          subtext="PayPal Sandbox orders"
          badge="PayPal API records"
        />
        <MetricCard
          icon={<CreditCard className="h-4 w-4 text-violet-400" />}
          label="Captured Volume"
          value={`${payload.site.currency} ${payload.summary.verifiedVolume.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtext="Confirmed settlements"
          badge="Zero Mock Revenue"
        />
        <MetricCard
          icon={<Activity className="h-4 w-4 text-cyan-400" />}
          label="Shopper Signals"
          value={payload.summary.interactionCount}
          subtext="Active session telemetry"
          badge="Current API session"
        />
      </div>

      {/* INLINE AG STUDIO WORKSPACE - FULLY VISIBLE DIRECTLY IN PAGE */}
      <div className={`transition-all duration-300 ${isFullscreen ? "fixed inset-0 z-50 bg-[#060c17] p-4 flex flex-col shadow-2xl" : "relative rounded-2xl border border-sky-400/25 bg-[#070e1b] p-3.5 shadow-2xl flex flex-col"}`}>
        {/* Workspace Toolbar Header */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Paylo AG Studio Report &amp; Copilot</h3>
                <span className="rounded bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-300 border border-sky-400/20">
                  {effectiveSiteName}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/25">
                  <Sparkles className="h-2.5 w-2.5" /> AG Grid 2026 Live
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Executive PayPal BI canvas + autonomous AI assistant. Scroll down smoothly to inspect live charts, catalog tiers, and captures.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/20 bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold text-blue-300">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              Copilot: {payload.assistant?.provider || "Checking configuration"}
            </span>
            <button
              onClick={() => setStudioMode((m) => (m === "view" ? "edit" : "view"))}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10 cursor-pointer transition-colors"
              title="Toggle between presentation view and widget edit mode"
            >
              {studioMode === "view" ? <Edit3 className="h-3.5 w-3.5 text-blue-400" /> : <Eye className="h-3.5 w-3.5 text-emerald-400" />}
              <span>{studioMode === "view" ? "Edit Mode" : "View Mode"}</span>
            </button>
            <button
              onClick={resetReport}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10 cursor-pointer transition-colors"
              title="Restore clean executive layout"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Layout</span>
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10 cursor-pointer transition-colors"
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              <span>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
            </button>
          </div>
        </div>

        {/* AG Studio Component Container (With Smooth Native Scrolling) */}
        <div className={`overflow-hidden rounded-xl border border-white/10 bg-[#08101e] [&_ag-studio]:h-full [&_ag-studio]:w-full ${isFullscreen ? "flex-1 min-h-0 w-full" : "h-[860px]"}`}>
          <AgStudioProvider modules={[AgStudioAiModule]}>
            <AgStudio
              key={`studio-${siteId}-${effectiveSiteName}-${reportInstance}`}
              mode={studioMode}
              data={data}
              initialState={savedInitialState}
              theme={theme}
              ai={ai}
              localeText={{
                panelTitleAi: "Paylo AI Copilot",
                aiMessageInputPlaceholder: `Ask Paylo about ${effectiveSiteName} catalog or PayPal captures…`,
                aiNewChat: "New Analysis",
              }}
              onStateUpdated={onStateUpdated}
            />
          </AgStudioProvider>
        </div>
      </div>

      {/* Catalog Price Map & PayPal Ledger Cards */}
      <div className="grid gap-4 xl:grid-cols-[1.4fr_.8fr]">
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(145deg,#0d1726,#080f1c)] p-5 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,.8)]" />
              <h3 className="font-bold text-sm text-white">{payload.site.name} Catalog Price Distribution</h3>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
              {payload.plans.length} offers loaded
            </span>
          </div>
          <div className="space-y-3">
            {[...payload.plans].sort((a, b) => a.price - b.price).map((plan, index) => {
              const maxPrice = Math.max(1, ...payload.plans.map((entry) => entry.price));
              const width = Math.max(6, Math.min(100, (plan.price / maxPrice) * 100));
              let formattedPrice = `${plan.currency || payload.site.currency} ${plan.price.toFixed(2)}`;
              try {
                formattedPrice = new Intl.NumberFormat("en-US", { style: "currency", currency: plan.currency || payload.site.currency, minimumFractionDigits: 2 }).format(plan.price);
              } catch { /* Fallback */ }
              return (
                <div key={plan.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-xs">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded border border-white/10 bg-white/5 text-[10px] font-bold text-slate-400">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate font-semibold text-slate-200">{plan.name}</span>
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">{plan.interval}</span>
                  </div>
                  <span className="font-bold tabular-nums text-white">
                    {formattedPrice}
                    <span className="ml-1 text-[10px] font-medium text-slate-500">
                      {plan.interval === "one-time" ? "one-time" : plan.interval === "yearly" ? "/yr" : "/mo"}
                    </span>
                  </span>
                  <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-blue-400" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
            {!payload.plans.length && (
              <p className="rounded-xl border border-dashed border-white/10 py-8 text-center text-xs text-slate-500">
                Analyze a merchant catalog to visualize plan prices here.
              </p>
            )}
          </div>
        </section>

        <section className="flex flex-col justify-between rounded-2xl border border-sky-400/20 bg-[radial-gradient(circle_at_85%_15%,rgba(14,165,233,.12),transparent_40%),linear-gradient(155deg,#0c1626,#070e1a)] p-5 shadow-lg">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">PayPal Ledger</p>
                <h3 className="mt-0.5 font-bold text-sm text-white">Cryptographic Settlement</h3>
              </div>
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-sky-400/20 bg-sky-500/10 text-sky-300">
                <ShieldCheck className="h-4 w-4" />
              </span>
            </div>

            <div className="my-5">
              <p className="text-4xl font-black tracking-tight text-white">
                {payload.summary.verifiedCaptureCount.toString().padStart(2, "0")}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                PayPal-confirmed Sandbox capture{payload.summary.verifiedCaptureCount === 1 ? "" : "s"}
              </p>
              <div className="mt-4 h-px bg-white/10" />
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-xs text-slate-400">Captured Volume</span>
                <strong className="text-base text-white">
                  {payload.site.currency} {payload.summary.verifiedVolume.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
            </div>
          </div>

          <p className="rounded-lg border border-white/10 bg-black/20 p-2.5 text-[11px] leading-relaxed text-slate-400">
            Only confirmed PayPal Sandbox capture webhooks trigger revenue recognition. Test carts, simulated clicks, and checkout drops are strictly excluded from financial reporting.
          </p>
        </section>
      </div>
    </section>
  );
}

function MetricCard({ icon, label, value, subtext, badge }: { icon: React.ReactNode; label: string; value: number | string; subtext: string; badge: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800/80 p-4 shadow-md">
      <div className="flex items-center justify-between">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5">{icon}</span>
        <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-400">{badge}</span>
      </div>
      <div className="mt-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-1 text-xl font-black tracking-tight text-slate-900 dark:text-white truncate">{value}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{subtext}</p>
      </div>
    </div>
  );
}
