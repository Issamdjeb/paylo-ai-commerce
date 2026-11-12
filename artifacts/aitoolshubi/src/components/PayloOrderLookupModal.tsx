import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Receipt,
  Search,
  CheckCircle2,
  ShieldCheck,
  Copy,
  Check,
  Printer,
  ExternalLink,
  PackageCheck,
  Clock,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

export interface VerifiedOrderReceipt {
  transactionId: string;
  orderId: string;
  amount: string;
  currency: string;
  product: string;
  itemName: string;
  payerEmail: string;
  payerName: string;
  merchantName: string;
  paidAt: string;
  timestamp: string;
  status: string;
  fulfillmentStatus: string;
  paymentMethod: string;
  protectionStatus: string;
  fee: string;
  tax: string;
  total: string;
}

interface PayloOrderLookupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId?: string;
  initialOrderId?: string;
}

export function PayloOrderLookupModal({
  open,
  onOpenChange,
  siteId = "aitoolshubi-com",
  initialOrderId,
}: PayloOrderLookupModalProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState(initialOrderId || "");
  const [orders, setOrders] = useState<VerifiedOrderReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<VerifiedOrderReceipt | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchOrders = async (query = "") => {
    setLoading(true);
    try {
      const q = encodeURIComponent(query);
      const s = encodeURIComponent(siteId);
      const res = await apiFetch(`/api/paylo/orders/lookup?query=${q}&siteId=${s}`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.orders) && data.orders.length > 0) {
          setOrders(data.orders);
          if (initialOrderId) {
            const match = data.orders.find((o: VerifiedOrderReceipt) => o.transactionId.toLowerCase().includes(initialOrderId.toLowerCase()));
            if (match) setSelectedReceipt(match);
          }
          return;
        }
      }
      setOrders([]);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchOrders(searchQuery);
    }
  }, [open]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders(searchQuery);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({ title: "Copied!", description: `Order reference copied to clipboard.` });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-background border-border shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Order Tracking & Instant PayPal Receipts</DialogTitle>
          <DialogDescription>
            Look up verified purchases, fulfillment status, and official PayPal receipts.
          </DialogDescription>
        </DialogHeader>

        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-[#0070ba]/15 via-blue-500/10 to-transparent p-4 sm:p-5 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-[#0070ba] text-white flex items-center justify-center font-black shadow-md">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground tracking-tight">
                    PayPal Sandbox captures
                  </h3>
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-black"
                  >
                    Demo data
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Real-time transaction tracking and itemized payment receipts on AItools Hubi
                </p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md border border-border/50">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
                  <span>Sandbox only</span>
            </div>
          </div>
        </div>

        {/* Content Body: Either Detail View or List View */}
        {selectedReceipt ? (
          /* Itemized Sandbox capture record */
          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to All Orders</span>
              </button>

              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs font-bold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {selectedReceipt.status}
              </Badge>
            </div>

            {/* Capture record (Printable) */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-4 shadow-sm" id="printable-receipt">
              <div className="flex items-start justify-between border-b border-border/60 pb-4">
                <div>
                  <div className="text-lg font-black text-[#0070ba] dark:text-[#38bdf8] tracking-tight">
                    PayPal
                  </div>
                  <div className="text-xs font-bold text-foreground mt-0.5">
                    Paylo capture record · verify current status in PayPal
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Merchant: {selectedReceipt.merchantName}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Amount Paid</div>
                  <div className="text-2xl font-extrabold text-foreground">
                    ${selectedReceipt.amount} {selectedReceipt.currency}
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    ✓ Paid in Full
                  </div>
                </div>
              </div>

              {/* Key Meta Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs py-1">
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Transaction ID:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-foreground truncate max-w-[170px]">
                      {selectedReceipt.transactionId}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedReceipt.transactionId, "txnid")}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Copy ID"
                    >
                      {copiedId === "txnid" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-right">
                  <span className="text-muted-foreground block text-[11px]">Payment Date:</span>
                  <span className="font-medium text-foreground">{selectedReceipt.paidAt}</span>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Billed To:</span>
                  <span className="font-medium text-foreground block truncate">{selectedReceipt.payerEmail}</span>
                </div>

                <div className="space-y-1 text-right">
                  <span className="text-muted-foreground block text-[11px]">Payment Method:</span>
                  <span className="font-medium text-foreground">{selectedReceipt.paymentMethod}</span>
                </div>
              </div>

              {/* Itemized Breakdown Table */}
              <div className="rounded-xl border border-border/70 overflow-hidden">
                <div className="bg-muted/40 px-3 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex justify-between">
                  <span>Description</span>
                  <span>Amount</span>
                </div>
                <div className="p-3 divide-y divide-border/40 text-xs">
                  <div className="py-2 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-foreground">{selectedReceipt.product}</div>
                      <div className="text-[11px] text-muted-foreground">PayPal Sandbox capture</div>
                    </div>
                    <span className="font-bold text-foreground">${selectedReceipt.amount}</span>
                  </div>
                  <div className="py-1.5 flex justify-between text-muted-foreground text-[11px]">
                    <span>Processing fees</span>
                    <span>{selectedReceipt.fee}</span>
                  </div>
                  <div className="py-1.5 flex justify-between text-muted-foreground text-[11px]">
                    <span>Tax / VAT</span>
                    <span>{selectedReceipt.tax}</span>
                  </div>
                  <div className="pt-2 flex justify-between font-extrabold text-sm text-foreground">
                    <span>Total Charged</span>
                    <span className="text-[#0070ba] dark:text-[#38bdf8]">
                      ${selectedReceipt.amount} {selectedReceipt.currency}
                    </span>
                  </div>
                </div>
              </div>

              {/* Fulfillment & Protection Guarantee */}
              <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3 flex items-start gap-2.5">
                <PackageCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">
                    Order Status: {selectedReceipt.fulfillmentStatus}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    This record confirms a PayPal Sandbox capture only. Fulfillment and applicable buyer protections must be checked with the merchant and PayPal.
                  </p>
                </div>
              </div>
            </div>

            {/* Receipt Actions */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                onClick={handlePrint}
                className="flex-1 bg-[#0070ba] hover:bg-[#005ea6] text-white font-bold h-9 shadow-sm flex items-center justify-center gap-1.5"
              >
                <Printer className="h-4 w-4" />
                <span>Print capture record / Save PDF</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => handleCopy(`${window.location.origin}/receipt?txn=${selectedReceipt.transactionId}`, "link")}
                className="h-9 border-border text-xs font-semibold hover:bg-muted"
              >
                {copiedId === "link" ? <Check className="h-4 w-4 text-emerald-500 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                <span>{copiedId === "link" ? "Link Copied" : "Copy Receipt Link"}</span>
              </Button>
            </div>
          </div>
        ) : (
          /* Search & List of Verified Orders */
          <div className="p-4 sm:p-5 space-y-4">
            {/* Search Input Bar (Bulletproof Flex Layout) */}
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Order ID (ORDER-PAYPAL-...), Plan, or Email..."
                  className="pl-9 h-10 text-xs bg-muted/20 border-border w-full shadow-inner"
                />
              </div>
              <Button
                type="submit"
                className="h-10 px-4 text-xs font-bold bg-[#0070ba] hover:bg-[#005ea6] text-white shrink-0 flex items-center gap-1.5 shadow-sm"
              >
                {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                <span>Lookup</span>
              </Button>
            </form>

            {/* Order Count Subhead */}
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>{orders.length} Sandbox capture records found</span>
              <span className="font-mono text-[10px]">Immutable Ledger Grounded</span>
            </div>

            {/* Order List */}
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {loading ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                  Searching recorded PayPal Sandbox captures...
                </div>
              ) : orders.length === 0 ? (
                <div className="py-12 text-center rounded-xl border border-dashed border-border p-6 text-xs text-muted-foreground">
            {loading ? "Loading PayPal Sandbox capture records…" : "No PayPal Sandbox capture records are available. A receipt appears here only after PayPal confirms a real Sandbox capture."}
                </div>
              ) : (
                orders.map((order) => (
                  <div
                    key={order.transactionId}
                    onClick={() => setSelectedReceipt(order)}
                    className="rounded-xl border border-border/70 hover:border-blue-500/50 bg-card/60 hover:bg-muted/30 p-3 transition-all cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                            {order.product}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[9px] font-black bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                          >
                            COMPLETED
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-1.5">
                          <span>{order.transactionId}</span>
                          <span>·</span>
                          <span>{order.paidAt}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Purchased by <strong className="text-foreground">{order.payerEmail}</strong>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-extrabold text-foreground">
                          ${order.amount} {order.currency}
                        </div>
                        <div className="text-[10px] text-blue-500 flex items-center gap-0.5 justify-end mt-1 font-semibold group-hover:translate-x-0.5 transition-transform">
                          <span>View Receipt</span>
                          <ArrowRight className="h-3 w-3" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer Note */}
            <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
                Sandbox records only · verify coverage with PayPal
              </span>
              <span>AItools Hubi &middot; 2026</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

