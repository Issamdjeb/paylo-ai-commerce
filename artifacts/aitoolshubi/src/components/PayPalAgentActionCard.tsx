import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard,
  QrCode,
  Send,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  FileText,
  Loader2,
  Wallet,
  ArrowUpRight,
  Receipt,
  Printer,
  Copy,
  Check,
  Building,
  RefreshCw,
  X,
  ShieldAlert,
  Gift,
  PackageCheck,
  Award,
  ArrowRight,
  Lock,
  Zap,
  Package,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { PayPalCheckoutModal } from "./PayPalCheckoutModal";
import { PayPalPayIn4Calculator } from "./PayPalPayIn4Calculator";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

export interface AgentActionPayload {
  type:
    | "PAYPAL_CHECKOUT"
    | "PAYPAL_INVOICE"
    | "PAYPAL_INSIGHTS"
    | "PAYPAL_BALANCE"
    | "PAYPAL_RECEIPT"
    | "PAYPAL_DISPUTE_SHIELD"
    | "PAYPAL_BUNDLE_QUIZ"
    | "PAYPAL_PAY_IN_4"
    | "STUDIO_NAVIGATE";
  studioTab?: "overview" | "payments" | "balances" | "invoices" | "radar" | "catalog" | "customers" | "scheduler" | "integrations" | "api";
  navigationTitle?: string;
  navigationDesc?: string;
  todayRevenue?: string;
  conversionRate?: string;
  totalOrders?: number;
  tier?: "community" | "featured" | "premium" | "lifetime";
  interval?: "monthly" | "yearly" | "one-time";
  amount?: string;
  currency?: string;
  currencySymbol?: string;
  planName?: string;
  merchantName?: string;
  siteId?: string;
  planId?: string;
  description?: string;
  features?: string[];
  isPayIn4?: boolean;
  installmentAmount?: string;
  couponCode?: string;
  discountPercent?: number;
  originalPrice?: string;
  savings?: string;
  // Dispute Shield props
  transactionId?: string;
  date?: string;
  protectionStatus?: string;
  sellerHealth?: string;
  partialRefundAmount?: string;
  resolutions?: Array<{
    id: string;
    label: string;
    description: string;
  }>;
  // Bundle Quiz props
  bundles?: Array<{
    id: string;
    name: string;
    targetPersona: string;
    originalTotal: string;
    bundlePrice: string;
    savings: string;
    currency: string;
    items: string[];
    planId: string;
    interval: "monthly" | "yearly" | "one-time";
  }>;
  invoice?: {
    id: string;
    invoiceNumber: string;
    recipientEmail: string;
    recipientName?: string;
    amount: string;
    currency: string;
    itemName: string;
    itemDescription?: string;
    status: "DRAFT" | "SENT" | "PAID" | "CANCELLED";
    createdAt: string;
    dueDate: string;
    note?: string;
    qrCodeUrl?: string;
    viewUrl?: string;
    mode?: string;
  };
  invoiceDraft?: {
    recipientEmail?: string;
    recipientName?: string;
    amount?: string;
    currency?: string;
    itemName?: string;
  };
  balance?: {
    available: string;
    pending: string;
    currency: string;
    currencies?: { [key: string]: string };
    accountStatus: string;
    isLive?: boolean;
    bankLast4?: string;
    lastUpdated?: string;
  };
  receipt?: {
    id: string;
    transactionId: string;
    amount: string;
    currency: string;
    payerName: string;
    payerEmail: string;
    itemName: string;
    planName: string;
    paymentMethod: string;
    paidAt: string;
    status: string;
    subtotal: string;
    tax: string;
    merchantName: string;
  };
  totalVolume?: string;
  growth?: string;
  activeSubscribers?: number;
  averageOrder?: string;
  disputes?: number;
  accountHealth?: string;
  healthScore?: number;
  activeClaims?: number;
}

interface PayPalAgentActionCardProps {
  action: AgentActionPayload;
  onSuccess?: () => void;
}

export function PayPalAgentActionCard({ action, onSuccess }: PayPalAgentActionCardProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutSandboxReady, setCheckoutSandboxReady] = useState<boolean | null>(null);
  const [checkoutPlanReady, setCheckoutPlanReady] = useState<boolean | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [invoiceSent, setInvoiceSent] = useState(action.invoice?.status === "SENT");
  const [createdInvoice, setCreatedInvoice] = useState<AgentActionPayload["invoice"]>(action.invoice);
  const [invoiceDraft, setInvoiceDraft] = useState({
    recipientEmail: action.invoiceDraft?.recipientEmail || "",
    recipientName: action.invoiceDraft?.recipientName || "",
    amount: action.invoiceDraft?.amount || "",
    itemName: action.invoiceDraft?.itemName || "",
  });
  const [copiedTxn, setCopiedTxn] = useState(false);
  const [selectedCurrencyTab, setSelectedCurrencyTab] = useState<string>("USD");
  const [syncingBalance, setSyncingBalance] = useState(false);
  const [localBalance, setLocalBalance] = useState<any>(action.balance || null);

  useEffect(() => {
    if (action.type !== "PAYPAL_CHECKOUT") return;
    let active = true;
    setCheckoutSandboxReady(null);
    setCheckoutPlanReady(null);
    apiFetch("/api/paypal/config")
      .then((response) => {
        if (!active) return;
        if (!response.ok) {
          setCheckoutSandboxReady(false);
          setCheckoutPlanReady(false);
          return;
        }
        response.json().then((config) => {
          const isCustomMerchant = action.siteId && !["aitoolshubi", "aitoolshubi-com"].includes(action.siteId);
          const planKey = action.interval === "one-time" ? null : `${action.tier || "community"}-${action.interval || "monthly"}`;
          setCheckoutSandboxReady(true);
          setCheckoutPlanReady(Boolean(!isCustomMerchant && (!planKey || config.planIds?.[planKey])));
        }).catch(() => { setCheckoutSandboxReady(false); setCheckoutPlanReady(false); });
      })
      .catch(() => {
        if (active) {
          setCheckoutSandboxReady(false);
          setCheckoutPlanReady(false);
        }
      });
    return () => { active = false; };
  }, [action.type, action.tier, action.interval]);

  // Dispute Shield state
  const [resolvingDisputeId, setResolvingDisputeId] = useState<string | null>(null);
  const [disputeSettledResult, setDisputeSettledResult] = useState<{
    resolutionLabel: string;
    refundTransactionId: string;
    settledAt: string;
    message?: string;
  } | null>(null);

  // Bundle checkout state
  const [bundleCheckout, setBundleCheckout] = useState<{
    open: boolean;
    tier: "community" | "featured";
    planName: string;
    price: number;
    interval: "monthly" | "yearly" | "one-time";
  }>({
    open: false,
    tier: "community",
    planName: "",
    price: 0,
    interval: "one-time",
  });

  // -------------------------------------------------------------
  // Render: PAYPAL_BALANCE (Killer feature!)
  // -------------------------------------------------------------
  if (action.type === "PAYPAL_BALANCE") {
    const bal = localBalance || action.balance;
    if (!bal || bal.isLive !== true) {
      return (
        <div className="mt-3 rounded-xl border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
          PayPal did not return a verified balance. No balance or bank details are available.
        </div>
      );
    }

    const handleSyncLiveBalance = async () => {
      setSyncingBalance(true);
      try {
        const res = await fetch("/api/paylo/balance/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId: "aitoolshubi" }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.balance) {
            setLocalBalance(data.balance);
            toast({
              title: "Balance Synchronized",
              description: `Sandbox balance: $${data.balance.available || "0.00"} USD (${data.balance.accountStatus || "Verified Account"}).`,
            });
            return;
          }
        }
      } catch {
        // Fallback
      } finally {
        setSyncingBalance(false);
      }
      toast({ title: "Balance unavailable", description: "PayPal could not return a verified balance. Check the server connection and try again.", variant: "destructive" });
    };

    return (
      <div className="mt-3 rounded-2xl border border-blue-500/30 bg-gradient-to-br from-card/95 via-card to-blue-950/20 p-4 shadow-xl backdrop-blur-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-500 font-black">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-black text-foreground tracking-wide flex items-center gap-1.5">
                PayPal balance
              </span>
              <span className="text-[10px] text-muted-foreground block">
                Returned by PayPal · {bal.lastUpdated || "recently"}
              </span>
            </div>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] uppercase font-bold tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
          >
            Verified response
          </Badge>
        </div>

        {/* Main Available Balance Hero Box */}
        <div className="bg-background/90 rounded-xl p-4 border border-border/80 shadow-inner mb-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Total Available Balance
              </span>
              <div className="text-3xl font-black text-foreground mt-0.5 tracking-tight flex items-baseline gap-1">
                <span className="text-blue-500">$</span>
                <span>{bal.available}</span>
                <span className="text-xs font-bold text-muted-foreground ml-1">
                  {bal.currency || "USD"}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-semibold text-muted-foreground block">
                Withheld balance
              </span>
              <span className="text-sm font-bold text-amber-500">${bal.pending}</span>
            </div>
          </div>

          {/* Multicurrency selector pills */}
          {bal.currencies && (
            <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-xs">
              <span className="text-[11px] font-semibold text-muted-foreground">Currencies returned by PayPal:</span>
              <div className="flex items-center gap-1.5">
                {(Object.entries(bal.currencies) as Array<[string, string]>).map(([curr, val]) => (
                  <button
                    key={curr}
                    type="button"
                    onClick={() => setSelectedCurrencyTab(curr)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                      selectedCurrencyTab === curr
                        ? "bg-[#0070ba] text-white shadow-xs"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {curr}: {val}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Refresh verified balance; payouts are not wired to this demo. */}
        <div className="grid grid-cols-1 gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSyncLiveBalance}
            disabled={syncingBalance}
            className="h-9 text-xs font-semibold border-border hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 text-primary ${syncingBalance ? "animate-spin" : ""}`} />
            <span>{syncingBalance ? "Syncing..." : "Sync Sandbox"}</span>
          </Button>
        </div>

        {/* Security Footer */}
        <div className="mt-2.5 flex items-center justify-between text-[10px] text-muted-foreground px-1">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-blue-500" />
            {bal.accountStatus}
          </span>
          <span className="opacity-80">Bank payouts are not connected in this demo.</span>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Render: PAYPAL_RECEIPT (Killer feature!)
  // -------------------------------------------------------------
  if (action.type === "PAYPAL_RECEIPT") {
    const rcpt = action.receipt;
    if (!rcpt?.transactionId || !rcpt.status) {
      return (
        <div className="mt-3 rounded-xl border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
          No verified PayPal capture record was provided. Paylo has not generated a receipt.
        </div>
      );
    }

    const handlePrintReceipt = () => {
      setShowReceiptModal(true);
    };

    const handleCopyTransaction = () => {
      navigator.clipboard.writeText(rcpt.transactionId);
      setCopiedTxn(true);
      toast({ title: "Copied!", description: `Transaction ID copied to clipboard.` });
      setTimeout(() => setCopiedTxn(false), 2000);
    };

    return (
      <div className="mt-3 rounded-2xl border border-primary/25 bg-gradient-to-br from-card via-card to-primary/5 p-4 shadow-xl backdrop-blur-md">
        {/* Receipt Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[#0070ba]/15 text-[#0070ba] flex items-center justify-center font-black">
              <Receipt className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-black text-foreground tracking-wide">
                Paylo capture record
              </span>
              <span className="text-[10px] text-muted-foreground block font-mono">
                {rcpt.transactionId}
              </span>
            </div>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 flex items-center gap-1"
          >
            <Check className="h-3 w-3" /> {rcpt.status}
          </Badge>
        </div>

        {/* Receipt Details Box */}
        <div className="bg-background/90 rounded-xl p-3.5 border border-border/70 space-y-2 text-xs mb-3">
          <div className="flex justify-between items-baseline">
            <span className="text-muted-foreground">Merchant:</span>
            <span className="font-bold text-foreground">{rcpt.merchantName}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-muted-foreground">Item Description:</span>
            <span className="font-semibold text-foreground truncate max-w-[200px]">
              {rcpt.itemName}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-muted-foreground">Payment Method:</span>
            <span className="font-medium text-foreground">{rcpt.paymentMethod}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-muted-foreground">Date:</span>
            <span className="text-muted-foreground">{rcpt.paidAt}</span>
          </div>

          <div className="pt-2 border-t border-border/60 flex justify-between items-baseline">
            <span className="font-bold text-foreground">Total Paid:</span>
            <span className="text-base font-black text-blue-500">
              ${rcpt.amount} {rcpt.currency}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            onClick={handlePrintReceipt}
            className="h-8 bg-[#0070ba] hover:bg-[#003087] text-white font-bold text-xs"
          >
            <Printer className="h-3.5 w-3.5 mr-1" />
            <span>View & Print</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyTransaction}
            className="h-8 text-xs font-semibold border-border hover:bg-muted"
          >
            {copiedTxn ? <Check className="h-3.5 w-3.5 mr-1 text-blue-500" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
            <span>{copiedTxn ? "Copied" : "Copy Txn ID"}</span>
          </Button>
        </div>

        {/* Interactive Printable Modal */}
        <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
          <DialogContent className="max-w-md bg-white text-slate-900 border shadow-2xl p-6">
            <DialogHeader className="border-b pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-[#0070ba] text-white flex items-center justify-center font-black text-sm">
                    P
                  </div>
                  <div>
                    <DialogTitle className="text-base font-black text-slate-900">
                      PayPal Official Receipt
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                      AItools Hubi Autonomous Commerce Settlement
                    </DialogDescription>
                  </div>
                </div>
                <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-bold">
                  COMPLETED
                </Badge>
              </div>
            </DialogHeader>

            <div className="py-4 space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Transaction ID:</span>
                <span className="font-mono font-bold text-slate-800">{rcpt.transactionId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Payer Name:</span>
                <span className="font-semibold text-slate-800">{rcpt.payerName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Payer Email:</span>
                <span className="text-slate-800">{rcpt.payerEmail}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Item:</span>
                <span className="font-semibold text-slate-800">{rcpt.itemName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Payment Engine:</span>
                <span className="text-slate-800">PayPal REST v2 Orders API</span>
              </div>
              <div className="flex justify-between pt-2 text-sm font-black text-slate-900">
                <span>Total Amount:</span>
                <span className="text-blue-700">${rcpt.amount} {rcpt.currency}</span>
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReceiptModal(false)}
                className="text-xs text-slate-600"
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => window.print()}
                className="bg-[#0070ba] hover:bg-[#003087] text-white text-xs font-bold gap-1"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Receipt</span>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Render: PAYPAL_CHECKOUT
  // -------------------------------------------------------------
  if (action.type === "PAYPAL_CHECKOUT") {
    if (!action.siteId || !action.planId) {
      return <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted-foreground">Checkout is unavailable because Paylo could not verify this plan against the merchant catalog.</div>;
    }

    // External stores (Notion, Linear, Cursor, etc.) are for knowledge ingestion & analysis ONLY.
    if (action.siteId && !["aitoolshubi", "aitoolshubi-com"].includes(action.siteId)) {
      return (
        <div className="mt-3 rounded-xl border border-primary/30 bg-muted/40 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5 text-blue-500" />
              <span>{action.merchantName || "External Store"} · Ingestion Mode</span>
            </span>
            <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">
              Catalog Analysis
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Live 1-Click PayPal Sandbox checkout is active on <strong>AItools Hubi</strong>. External stores are ingested for competitive pricing analysis only.
          </p>
        </div>
      );
    }

    const planNameLower = (action.planName || "").toLowerCase();
    const planIdLower = (action.planId || "").toLowerCase();
    const isOneTime =
      action.interval === "one-time" ||
      planNameLower.includes("one-time") ||
      planNameLower.includes("lifetime") ||
      planNameLower.includes("founding pass") ||
      planIdLower.includes("lifetime") ||
      planIdLower.includes("one-time");
    const isYearly =
      !isOneTime && (
        action.interval === "yearly" ||
        planNameLower.includes("annual") ||
        planNameLower.includes("yearly") ||
        planIdLower.includes("yearly") ||
        planIdLower.includes("annual")
      );
    const checkoutInterval: "monthly" | "yearly" | "one-time" = isOneTime ? "one-time" : isYearly ? "yearly" : "monthly";

    // Accurately resolve tier from explicit tier or plan name
    const detectedTier: "community" | "featured" | "premium" | "lifetime" | "fast_track" | "spotlight" =
      action.tier ||
      (planNameLower.includes("lifetime") || planNameLower.includes("founding pass") || planNameLower.includes("vip")
        ? "lifetime"
        : planNameLower.includes("premium")
        ? "premium"
        : planNameLower.includes("featured")
        ? "featured"
        : planNameLower.includes("spotlight")
        ? "spotlight"
        : planNameLower.includes("fast")
        ? "fast_track"
        : "community");

    // Standard catalog pricing definitions
    const CATALOG_RATES: Record<string, { monthly: string; yearly: string }> = {
      community: { monthly: "6.00", yearly: "59.00" },
      featured: { monthly: "19.00", yearly: "148.00" },
      premium: { monthly: "49.00", yearly: "399.00" },
    };

    // Keep the catalog-selected amount and interval intact through PayPal review.
    // The API independently compares these details with its canonical price.
    const amount = action.amount || (isOneTime
      ? detectedTier === "spotlight" ? "129.00" : detectedTier === "fast_track" ? "39.00" : "99.00"
      : CATALOG_RATES[detectedTier]?.[isYearly ? "yearly" : "monthly"] || "6.00");

    const displayPlanName = isOneTime
      ? action.planName || "Lifetime Founding Pass"
      : isYearly
      ? action.planName
        ? action.planName.replace(/\s*\(Pay in 4\)/gi, "").replace(/\s*\(Annual\)/gi, "").trim() + " (Annual)"
        : "AItools Hubi Plan (Annual)"
      : action.planName
      ? action.planName.replace(/\s*\(Annual\)/gi, "").trim()
      : "AItools Hubi Plan";

    const currSymbol =
      action.currencySymbol ||
      (action.currency === "EUR"
        ? "€"
        : action.currency === "GBP"
        ? "£"
        : action.currency === "JPY"
        ? "¥"
        : action.currency === "CAD"
        ? "C$"
        : action.currency === "AUD"
        ? "A$"
        : "$");
    const currCode = action.currency || "USD";
    const numericAmount = parseFloat(amount) || 0;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 28 }}
        className="mt-3 rounded-xl border border-primary/20 bg-gradient-to-br from-card/90 via-card to-primary/5 p-4 shadow-lg backdrop-blur-md transition-all"
      >
        {/* Header Badge */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-[#0070ba]/15 border border-[#0070ba]/30 flex items-center justify-center font-black text-[#0070ba] text-xs">
              P
            </div>
            <span className="text-xs font-bold text-foreground tracking-wide">
            PayPal Checkout
            </span>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] uppercase font-bold tracking-wider ${checkoutSandboxReady && checkoutPlanReady ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" : "bg-amber-500/10 text-amber-700 border-amber-500/20"}`}
          >
            {checkoutSandboxReady === null ? "Checking Sandbox" : !checkoutSandboxReady ? "Sandbox setup required" : !checkoutPlanReady ? "Recurring plan setup required" : "Ready to review"}
          </Badge>
        </div>

        {/* Plan Details Box */}
        <div className="bg-background/80 rounded-lg p-3 border border-border/60 mb-3">
          <div className="flex items-baseline justify-between mb-1">
            <h4 className="font-bold text-sm text-foreground">{displayPlanName}</h4>
            <div className="text-right">
              <span className="text-lg font-black text-primary">
                {currSymbol}{amount}
              </span>
              <span className="text-[11px] text-muted-foreground ml-1">
                {currCode !== "USD" ? `${currCode} ` : ""}
                {isOneTime ? "one-time" : isYearly ? "/year" : "/mo"}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {action.description || "Review the plan and billing details in PayPal before approving."}
          </p>

          {isOneTime && (
            <div className="mt-2.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-md text-[11px] text-blue-500 font-medium text-center">
              One-time payment
            </div>
          )}
        </div>

        {/* CTA Button */}
        <Button
          onClick={() => setCheckoutOpen(true)}
          disabled={checkoutSandboxReady !== true || checkoutPlanReady !== true}
          className="w-full bg-[#0070ba] hover:bg-[#003087] text-white font-bold h-10 shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CreditCard className="h-4 w-4" />
          <span>{checkoutSandboxReady === false ? "Configure PayPal Sandbox to continue" : checkoutSandboxReady === null ? "Checking PayPal Sandbox…" : checkoutPlanReady === false ? "Prepare this recurring plan in Paylo Setup" : `Pay with PayPal · ${currSymbol}${amount}`}</span>
        </Button>

        <div className="mt-2.5 text-[10px] text-muted-foreground px-1">
          {checkoutSandboxReady === false
            ? "Connect the Sandbox app from Paylo Setup, Step 2. Live credentials are not used for this demo."
            : checkoutPlanReady === false
            ? "PayPal has no verified Sandbox subscription plan for this catalog tier yet. Reconnect the Sandbox app from Paylo Setup, Step 2."
            : "PayPal will show the final payment details. Nothing is charged until you approve there."}
        </div>

        {/* Modal */}
        <PayPalCheckoutModal
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          planTier={detectedTier}
          planName={displayPlanName}
          price={numericAmount}
          billingInterval={checkoutInterval}
          siteId={action.siteId}
          catalogPlanId={action.planId}
          planDescription={action.description}
          planFeatures={action.features}
          merchantName={action.merchantName}
          redirectAfterSuccess={false}
          fixedPlan
          onSuccess={() => {
            setCheckoutOpen(false);
            if (onSuccess) onSuccess();
            toast({
              title: "Payment Confirmed",
              description: `${displayPlanName} payment confirmed for ${action.merchantName || "merchant"}.`,
            });
          }}
        />
      </motion.div>
    );
  }

  // -------------------------------------------------------------
  // Render: PAYPAL_INVOICE (With in-app interactive viewer modal!)
  // -------------------------------------------------------------
  if (action.type === "PAYPAL_INVOICE" && (createdInvoice || action.invoiceDraft)) {
    const inv = createdInvoice;

    const handleCreateInvoiceDraft = async () => {
      setSendingInvoice(true);
      try {
        const res = await apiFetch("/api/paypal-agent/invoices/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientEmail: invoiceDraft.recipientEmail,
            recipientName: invoiceDraft.recipientName,
            amount: invoiceDraft.amount,
            itemName: invoiceDraft.itemName,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.invoice) throw new Error(data.error || "PayPal could not create the invoice draft.");
        setCreatedInvoice(data.invoice);
        toast({ title: "PayPal draft created", description: `Invoice ${data.invoice.invoiceNumber} is ready for review. It has not been sent.` });
      } catch (err) {
        toast({ title: "Invoice draft not created", description: err instanceof Error ? err.message : "PayPal Sandbox could not create the draft.", variant: "destructive" });
      } finally {
        setSendingInvoice(false);
      }
    };

    const handleSendInvoice = async () => {
      if (!inv) return;
      setSendingInvoice(true);
      try {
        const res = await apiFetch(`/api/paypal-agent/invoices/${inv.id}/send`, {
          method: "POST",
        });
        if (res.ok) {
          setInvoiceSent(true);
          toast({
            title: "PayPal Sandbox invoice sent",
            description: `Invoice #${inv.invoiceNumber} was sent by PayPal to ${inv.recipientEmail}.`,
          });
        } else {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "PayPal could not send the invoice.");
        }
      } catch (err) {
        toast({ title: "Invoice was not sent", description: err instanceof Error ? err.message : "PayPal could not send the invoice.", variant: "destructive" });
      } finally {
        setSendingInvoice(false);
      }
    };

    if (!inv) {
      const fieldClass = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";
      return (
        <div className="mt-3 rounded-xl border border-primary/25 bg-gradient-to-br from-card via-card to-primary/5 p-4 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-[#0070ba]" /><span className="text-xs font-bold">PayPal invoice draft</span></div>
            <Badge variant="outline" className="text-[10px]">Review required</Badge>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">Confirm the recipient, amount, and line item. This creates a PayPal Sandbox draft only; Paylo will not send it until you press the send button on the next card.</p>
          <div className="grid gap-2">
            <input className={fieldClass} type="email" aria-label="Invoice recipient email" placeholder="Recipient email" value={invoiceDraft.recipientEmail} onChange={(e) => setInvoiceDraft((current) => ({ ...current, recipientEmail: e.target.value }))} />
            <input className={fieldClass} aria-label="Invoice recipient name" placeholder="Recipient name (optional)" value={invoiceDraft.recipientName} onChange={(e) => setInvoiceDraft((current) => ({ ...current, recipientName: e.target.value }))} />
            <div className="grid grid-cols-[1fr_2fr] gap-2">
              <input className={fieldClass} inputMode="decimal" aria-label="Invoice amount in USD" placeholder="Amount (USD)" value={invoiceDraft.amount} onChange={(e) => setInvoiceDraft((current) => ({ ...current, amount: e.target.value }))} />
              <input className={fieldClass} aria-label="Invoice item description" placeholder="What is this invoice for?" value={invoiceDraft.itemName} onChange={(e) => setInvoiceDraft((current) => ({ ...current, itemName: e.target.value }))} />
            </div>
            <Button size="sm" onClick={handleCreateInvoiceDraft} disabled={sendingInvoice || !invoiceDraft.recipientEmail.trim() || !invoiceDraft.amount.trim() || !invoiceDraft.itemName.trim()} className="mt-1 bg-[#0070ba] text-white hover:bg-[#003087]">
              {sendingInvoice ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Create PayPal Sandbox draft
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-3 rounded-xl border border-primary/25 bg-gradient-to-br from-card via-card to-primary/5 p-4 shadow-lg backdrop-blur-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#0070ba]" />
            <span className="text-xs font-bold text-foreground">
              PayPal Invoice · {inv.invoiceNumber}
            </span>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] font-bold ${
              invoiceSent || inv.status === "SENT"
                ? "bg-blue-500/10 text-blue-500 border-blue-500/30"
                : "bg-amber-500/10 text-amber-500 border-amber-500/30"
            }`}
          >
            {invoiceSent ? "SENT" : inv.status}
          </Badge>
        </div>

        {/* Invoice Summary Box */}
        <div className="bg-background/80 rounded-lg p-3 border border-border/70 mb-3 space-y-1.5 text-xs">
          <div className="flex justify-between items-baseline">
            <span className="text-muted-foreground">Recipient:</span>
            <span className="font-semibold text-foreground">{inv.recipientEmail}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-muted-foreground">Item:</span>
            <span className="font-semibold text-foreground truncate max-w-[200px]">
              {inv.itemName}
            </span>
          </div>
          <div className="flex justify-between items-baseline pt-1 border-t border-border/50">
            <span className="font-bold text-foreground">Amount Due:</span>
            <span className="text-sm font-black text-primary">
              ${inv.amount} {inv.currency}
            </span>
          </div>
        </div>

        {/* QR Code preview inline */}
        {showQrModal && (
          <div className="mb-3 p-3 bg-white rounded-lg border flex flex-col items-center justify-center text-center animate-in fade-in duration-200">
            <img
              src={inv.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://paypal.com`}
              alt="PayPal Invoice QR Code"
              className="h-36 w-36 rounded shadow"
            />
            <p className="text-[11px] font-medium text-slate-800 mt-2">
              Scan with mobile phone or PayPal app to pay
            </p>
            <span className="text-[10px] text-slate-500">Invoice #{inv.invoiceNumber}</span>
          </div>
        )}

        {/* Actions Grid */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowQrModal(!showQrModal)}
            className="text-xs font-semibold h-8 border-border hover:bg-muted"
          >
            <QrCode className="h-3.5 w-3.5 mr-1 text-primary" />
            {showQrModal ? "Hide QR" : "Show QR Code"}
          </Button>

          <Button
            size="sm"
            onClick={handleSendInvoice}
            disabled={sendingInvoice || invoiceSent}
            className={`text-xs font-bold h-8 text-white ${
              invoiceSent
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-[#0070ba] hover:bg-[#003087]"
            }`}
          >
            {sendingInvoice ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : invoiceSent ? (
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            ) : (
              <Send className="h-3.5 w-3.5 mr-1" />
            )}
            {invoiceSent ? "Sent to Client" : "Send Invoice"}
          </Button>
        </div>

        {/* In-App Live Preview Button (Replaces broken 404 external link!) */}
        <div className="mt-2.5 text-center">
          <button
            type="button"
            onClick={() => setShowInvoiceModal(true)}
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-semibold cursor-pointer"
          >
            <FileText className="h-3 w-3" />
            <span>Open Interactive Invoice Inspector</span>
          </button>
        </div>

        {/* Interactive In-App Invoice Inspector Modal */}
        <Dialog open={showInvoiceModal} onOpenChange={setShowInvoiceModal}>
          <DialogContent className="max-w-lg bg-white text-slate-900 border shadow-2xl p-6">
            <DialogHeader className="border-b pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-[#0070ba] text-white flex items-center justify-center font-black text-base shadow-sm">
                    P
                  </div>
                  <div>
                    <DialogTitle className="text-base font-black text-slate-900">
                      PayPal Commercial Invoice
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                      Invoice #{inv.invoiceNumber} · Created via Paylo Autonomous Agent
                    </DialogDescription>
                  </div>
                </div>
                <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs font-bold">
                  {invoiceSent ? "SENT · AWAITING PAYMENT" : "DRAFT"}
                </Badge>
              </div>
            </DialogHeader>

            <div className="py-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Billed From</span>
                  <span className="font-bold text-slate-800">AItools Hubi Merchant</span>
                  <span className="text-[11px] text-slate-500 block">billing@aitoolshubi.com</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Billed To</span>
                  <span className="font-bold text-slate-800">{inv.recipientName || "Valued Client"}</span>
                  <span className="text-[11px] text-slate-500 block">{inv.recipientEmail}</span>
                </div>
              </div>

              {/* Line items table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-3 py-2 font-bold text-[11px] text-slate-700 flex justify-between">
                  <span>Description</span>
                  <span>Amount</span>
                </div>
                <div className="px-3 py-2.5 flex justify-between items-center text-slate-800 border-t border-slate-200">
                  <div>
                    <span className="font-semibold block">{inv.itemName}</span>
                    <span className="text-[10px] text-slate-500">
                      {inv.itemDescription || "Autonomous service fulfillment via PayPal AI Agent"}
                    </span>
                  </div>
                  <span className="font-bold text-sm">${inv.amount} {inv.currency}</span>
                </div>
              </div>

              {/* QR Code Scan Section */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-3">
                <img
                  src={inv.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://paypal.com`}
                  alt="Invoice QR"
                  className="h-16 w-16 rounded border bg-white p-0.5"
                />
                <div>
                  <span className="font-bold text-slate-900 block">Instant Mobile Payment</span>
                  <span className="text-[11px] text-slate-500 block">
                    Scan with any smartphone camera or the PayPal App to settle immediately.
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-between items-baseline border-t border-slate-200 font-black text-sm text-slate-900">
                <span>Total Due:</span>
                <span className="text-xl text-[#0070ba]">${inv.amount} {inv.currency}</span>
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInvoiceModal(false)}
                className="text-xs text-slate-600"
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => window.print()}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold gap-1"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print</span>
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setShowInvoiceModal(false);
                  setCheckoutOpen(true);
                }}
                className="bg-[#0070ba] hover:bg-[#003087] text-white text-xs font-bold gap-1"
              >
                <CreditCard className="h-3.5 w-3.5" />
                <span>Pay Invoice Now</span>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Render: STUDIO_NAVIGATE & PAYPAL_INSIGHTS
  // -------------------------------------------------------------
  if (action.type === "STUDIO_NAVIGATE" || action.type === "PAYPAL_INSIGHTS") {
    const targetTab = action.studioTab || "overview";
    const tabLabels: Record<string, string> = {
      overview: "Overview & Telemetry",
      payments: "Live Payments & Revenue",
      balances: "Treasury & Balances",
      invoices: "Invoices & Settlement",
      radar: "Radar & Conversion",
      catalog: "Product Catalog",
      customers: "Customer Directory",
      scheduler: "Commerce Scheduler",
      integrations: "Integrations",
      api: "API & Webhooks",
    };
    const tabTitle = tabLabels[targetTab] || "Merchant Studio";

    return (
      <div className="mt-3 rounded-2xl border border-blue-500/30 bg-gradient-to-br from-card via-slate-900/60 to-blue-950/30 p-4 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            <span className="text-xs font-bold text-foreground">
              {action.navigationTitle || "Paylo Merchant Studio Navigation"}
            </span>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] font-bold bg-blue-500/15 text-blue-400 border-blue-500/30 px-2 py-0.5"
          >
            Live Connected
          </Badge>
        </div>

        {action.navigationDesc && (
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            {action.navigationDesc}
          </p>
        )}

        {/* Real Dynamic Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3.5">
          <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              Today Revenue
            </div>
            <div className="text-base font-black text-emerald-500 dark:text-emerald-400 mt-0.5">
              {action.todayRevenue ?? "—"}
            </div>
            <div className="text-[9px] text-muted-foreground font-medium">
              {action.totalOrders != null ? `${action.totalOrders} Captures` : "No capture data"}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              Total TPV
            </div>
            <div className="text-base font-black text-foreground mt-0.5">
              {action.totalVolume ?? "—"}
            </div>
            <div className="text-[9px] text-blue-400 font-semibold flex items-center gap-0.5">
              <TrendingUp className="h-2 w-2" /> Live Ledger
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              Conversion
            </div>
            <div className="text-base font-black text-cyan-400 mt-0.5">
              {action.conversionRate ?? "—"}
            </div>
            <div className="text-[9px] text-muted-foreground font-medium">
              Intent-to-Pay
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              Health & Disputes
            </div>
            <div className="text-base font-black text-blue-400 mt-0.5">
              {action.healthScore == null ? "Unavailable" : `${action.healthScore}%`}
            </div>
            <div className="text-[9px] text-muted-foreground font-medium">
              {action.activeClaims == null ? "No dispute data" : `${action.activeClaims} disputes`}
            </div>
          </div>
        </div>

        {/* 1-Click Studio Navigation Button */}
        <Button
          onClick={() => navigate(`/paylo-studio?tab=${targetTab}`)}
          className="w-full h-10 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer transition-all hover:scale-[1.01]"
        >
          <Zap className="w-3.5 h-3.5 text-yellow-300" />
          <span>Open {tabTitle} in Paylo Studio</span>
          <ArrowUpRight className="w-3.5 h-3.5 ml-0.5 opacity-80" />
        </Button>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Render: PAYPAL_DISPUTE_SHIELD (Autonomous AI Conflict Resolution)
  // -------------------------------------------------------------
  if (action.type === "PAYPAL_DISPUTE_SHIELD") {
    return (
      <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
        <div className="font-semibold text-foreground">Dispute tools are not connected in this demo</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Paylo cannot verify a dispute, determine protection eligibility, or issue a refund here. Review the transaction in PayPal Resolution Center. No action was submitted.
        </p>
      </div>
    );

    const resolutions = (action.resolutions && action.resolutions.length > 0) ? action.resolutions : [
      {
        id: "partial_refund",
        label: "50% Partial Refund (Instant Credit)",
        description: "Authorizes an instant $19.50 USD refund to buyer while keeping 14-day directory feature active.",
      },
      {
        id: "credit_extension",
        label: "30-Day Pro Extension (Zero Fee)",
        description: "Credits 30 extra days of Pro visibility with zero dispute fee or chargeback record on your PayPal account.",
      },
      {
        id: "full_refund",
        label: "Full Refund & Order Cancellation",
        description: "Reverses $39.00 USD transaction immediately with autonomous PayPal dispute resolution record.",
      },
    ];
    const txnId = action.transactionId || "PP-TXN-74198218";
    const amount = action.amount || "39.00";
    const currency = action.currency || "USD";

    const handleResolveDispute = async (resolutionId: string) => {
      setResolvingDisputeId(resolutionId);
      try {
        const res = await apiFetch("/api/paylo/dispute/resolve", {
          method: "POST",
          body: JSON.stringify({
            siteId: "aitoolshubi-com",
            transactionId: txnId,
            resolutionId,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setDisputeSettledResult({
            resolutionLabel: data.resolutionLabel,
            refundTransactionId: data.refundTransactionId,
            settledAt: data.settledAt,
            message: data.message,
          });
          toast({
            title: "Dispute Resolved Autonomously",
            description: data.resolutionLabel,
          });
        }
      } catch {
        toast({
          title: "Could not resolve dispute",
          description: "No dispute action was submitted. Use PayPal’s Resolution Center.",
          variant: "destructive",
        });
      } finally {
        setResolvingDisputeId(null);
      }
    };

    return (
      <div className="mt-3 rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-card via-card to-amber-950/10 p-4 shadow-xl backdrop-blur-md overflow-hidden relative">
        {/* Animated shield glow background */}
        <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/5 via-transparent to-blue-500/5 pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between mb-3 relative">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/30">
              <ShieldAlert className="h-4.5 w-4.5" />
            </div>
            <div>
              <span className="text-xs font-black text-foreground tracking-wide flex items-center gap-1.5">
                PayPal Buyer Protection Shield
              </span>
              <span className="text-[10px] text-muted-foreground block">
                Autonomous AI Dispute Resolution Engine
              </span>
            </div>
          </div>
          <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px] font-black uppercase tracking-wider">
            100% Protected
          </Badge>
        </div>

        {/* Transaction Details Box */}
        <div className="bg-background/90 rounded-xl p-3.5 border border-border/70 mb-3 relative">
          <div className="grid grid-cols-2 gap-y-2 text-xs">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Transaction</span>
              <span className="font-mono font-bold text-foreground text-[11px]">{txnId}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Amount</span>
              <span className="font-black text-foreground">${amount} {currency}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Date</span>
              <span className="text-muted-foreground text-[11px]">{action.date || "Today"}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Seller Rating</span>
              <span className="text-blue-500 font-bold text-[11px]">
                {action.sellerHealth || "Tier 3 Optimum"}
              </span>
            </div>
          </div>

          {/* Protection Banner */}
          <div className="mt-2.5 pt-2.5 border-t border-border/60 flex items-center gap-2 text-[10px]">
            <Lock className="h-3 w-3 text-amber-500 shrink-0" />
            <span className="text-amber-600 dark:text-amber-400 font-bold">
              {action.protectionStatus || "PayPal Buyer Protection: Verified & Active"}
            </span>
          </div>
        </div>

        {/* Settlement Confirmation (shown after resolving) */}
        {disputeSettledResult ? (
          <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-xl p-4 text-center space-y-2">
            <div className="h-10 w-10 rounded-full bg-blue-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-500/30">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="text-sm font-black text-blue-600 dark:text-blue-400">
              Dispute Resolved Autonomously!
            </div>
            <div className="text-xs text-foreground font-semibold">
              {disputeSettledResult!.resolutionLabel}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              Refund Txn: {disputeSettledResult!.refundTransactionId}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Settled at {new Date(disputeSettledResult!.settledAt).toLocaleTimeString()} · Zero Dispute Fees
            </div>
          </div>
        ) : (
          /* Resolution Options */
          <div className="space-y-2">
            <div className="text-[10px] uppercase font-black text-muted-foreground tracking-wider mb-1.5">
              Choose Instant Resolution
            </div>
            {resolutions.map((res) => (
              <button
                key={res.id}
                type="button"
                onClick={() => handleResolveDispute(res.id)}
                disabled={resolvingDisputeId !== null}
                className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer group ${
                  resolvingDisputeId === res.id
                    ? "border-amber-500 bg-amber-500/10 shadow-md"
                    : "border-border hover:border-amber-500/50 hover:bg-amber-500/5 hover:shadow-md bg-background/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                      {res.id === "partial_refund" && <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                      {res.id === "credit_extension" && <ShieldCheck className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                      {res.id === "full_refund" && <CreditCard className="h-3.5 w-3.5 text-[#0070ba] shrink-0" />}
                      {res.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5 leading-relaxed">
                      {res.description}
                    </span>
                  </div>
                  {resolvingDisputeId === res.id ? (
                    <Loader2 className="h-4 w-4 text-amber-500 animate-spin shrink-0 ml-2" />
                  ) : (
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-amber-500 shrink-0 ml-2 transition-colors" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Trust Footer */}
        <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground px-1">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-amber-500" />
            PayPal Buyer Protection · 180-Day Coverage
          </span>
          <span className="opacity-80">Zero Hold Time · Instant Settlement</span>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Render: PAYPAL_BUNDLE_QUIZ (Autonomous Growth Stack Optimizer)
  // -------------------------------------------------------------
  if (action.type === "PAYPAL_BUNDLE_QUIZ") {
    const bundles = action.bundles || [];

    const handleActivateBundle = (bundle: typeof bundles[0]) => {
      setBundleCheckout({
        open: true,
        tier: bundle.planId.includes("featured") ? "featured" : "community",
        planName: bundle.name,
        price: parseFloat(bundle.bundlePrice),
        interval: bundle.interval,
      });
    };

    return (
      <div className="mt-3 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-card via-card to-purple-950/10 p-4 shadow-xl backdrop-blur-md overflow-hidden relative">
        {/* Decorative gradient */}
        <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/5 via-transparent to-cyan-500/5 pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between mb-3 relative">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/30">
              <PackageCheck className="h-4.5 w-4.5" />
            </div>
            <div>
              <span className="text-xs font-black text-foreground tracking-wide">
                AI Growth Bundle Optimizer
              </span>
              <span className="text-[10px] text-muted-foreground block">
                Curated stacks with exclusive bundle savings
              </span>
            </div>
          </div>
          <Badge className="bg-purple-500/15 text-purple-500 border-purple-500/30 text-[10px] font-black uppercase tracking-wider">
            AI Curated
          </Badge>
        </div>

        {/* Bundle Cards */}
        <div className="space-y-3 relative">
          {bundles.map((bundle, idx) => (
            <div
              key={bundle.id}
              className="bg-background/90 rounded-xl p-3.5 border border-border/70 hover:border-purple-500/40 transition-all hover:shadow-md group"
            >
              {/* Bundle Header */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                      {idx === 0 ? <Package className="h-3.5 w-3.5 text-purple-400 shrink-0" /> : <ArrowUpRight className="h-3.5 w-3.5 text-cyan-400 shrink-0" />}
                      {bundle.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    For: {bundle.targetPersona}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground line-through block">
                    ${bundle.originalTotal}
                  </span>
                  <span className="text-sm font-black text-purple-500">
                    ${bundle.bundlePrice}
                  </span>
                  <span className="text-[10px] text-purple-400 font-bold block">
                    {bundle.interval === "one-time" ? "one-time" : `/${bundle.interval}`}
                  </span>
                </div>
              </div>

              {/* Savings Badge */}
              <div className="mb-2.5">
                <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px] font-bold">
                  <Zap className="h-3 w-3 mr-1" />
                  Save {bundle.savings}
                </Badge>
              </div>

              {/* Items Checklist */}
              <div className="space-y-1 mb-3">
                {bundle.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px]">
                    <CheckCircle2 className="h-3 w-3 text-blue-500 shrink-0 mt-0.5" />
                    <span className="text-foreground/80 leading-snug">{item}</span>
                  </div>
                ))}
              </div>

              {/* CTA Button */}
              <Button
                onClick={() => handleActivateBundle(bundle)}
                className="w-full h-9 bg-gradient-to-r from-[#0070ba] to-[#003087] hover:from-[#003087] hover:to-[#001845] text-white font-bold text-xs shadow-md transition-all active:scale-[0.98]"
              >
                <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                Activate with PayPal · ${bundle.bundlePrice}
              </Button>
            </div>
          ))}
        </div>

        {/* Trust Footer */}
        <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground px-1 relative">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-purple-400" />
            PayPal Buyer Protection · Cancel Anytime
          </span>
          <span className="opacity-80">Exclusive Bundle Pricing</span>
        </div>

        {/* PayPal Checkout Modal for bundle purchase */}
        <PayPalCheckoutModal
          open={bundleCheckout.open}
          onOpenChange={(open) => setBundleCheckout((prev) => ({ ...prev, open }))}
          planTier={bundleCheckout.tier}
          planName={bundleCheckout.planName}
          price={bundleCheckout.price}
          billingInterval={bundleCheckout.interval}
          onSuccess={() => {
            setBundleCheckout((prev) => ({ ...prev, open: false }));
            toast({
              title: "Bundle Activated",
              description: `${bundleCheckout.planName} is now live with PayPal checkout!`,
            });
          }}
        />
      </div>
    );
  }

  if (action.type === "PAYPAL_PAY_IN_4") {
    const initAmt = parseFloat(String(action.amount || "49").replace(/[^0-9.]/g, "")) || 49;
    return (
      <div className="mt-3">
        <PayPalPayIn4Calculator
          initialAmount={initAmt}
          selectedPlanId={action.planId}
          currency={action.currency || "USD"}
          currencySymbol={action.currencySymbol || "$"}
          siteId={action.siteId || "aitoolshubi-com"}
          merchantName={action.merchantName || "AItools Hubi"}
          onCheckout={(details) => {
            setCheckoutOpen(true);
          }}
        />
        {/* PayPal Checkout Modal triggered when user accepts financing terms */}
        <PayPalCheckoutModal
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          planTier={(action.tier as any) || "featured"}
          planName={action.planName || "PayPal Pay in 4 Order"}
          price={parseFloat(action.amount || `${initAmt}`) || initAmt}
          billingInterval={action.interval || "one-time"}
          siteId={action.siteId || "aitoolshubi-com"}
          catalogPlanId={action.planId}
          merchantName={action.merchantName || "AItools Hubi"}
          onSuccess={() => {
            setCheckoutOpen(false);
            if (onSuccess) onSuccess();
          }}
        />
      </div>
    );
  }

  return null;
}
