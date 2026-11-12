import React, { useState, useMemo, useEffect } from "react";
import {
  CreditCard,
  ShieldCheck,
  Zap,
  ArrowRight,
  Percent,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export interface PayIn4Plan {
  id: string;
  name: string;
  price: number | string;
  interval?: string;
  description?: string;
}

interface PayPalPayIn4CalculatorProps {
  initialAmount?: number;
  currency?: string;
  currencySymbol?: string;
  plans?: PayIn4Plan[];
  selectedPlanId?: string;
  siteId?: string;
  merchantName?: string;
  onCheckout?: (planDetails: {
    planName: string;
    amount: string;
    currency: string;
    tier?: string;
    planId?: string;
    siteId?: string;
    isPayIn4: boolean;
  }) => void;
  className?: string;
  compact?: boolean;
}

// Verified official AItools Hubi catalog plans from Paylo Studio
const DEFAULT_HUBI_PLANS: PayIn4Plan[] = [
  {
    id: "premium-media-package",
    name: "Premium Partner & Media Package",
    price: 49,
    interval: "monthly",
    description: "Homepage hero promotion & weekly newsletter feature",
  },
  {
    id: "lifetime-vip-pass",
    name: "Lifetime VIP Founding Pass",
    price: 99,
    interval: "one-time",
    description: "Lifetime Pro privileges & exclusive Founding Member badge",
  },
  {
    id: "pro-community-yearly",
    name: "Pro Community (Annual)",
    price: 59,
    interval: "yearly",
    description: "Save 18% on full builder privileges for a full year",
  },
  {
    id: "featured-partner-yearly",
    name: "Featured Partner (Annual)",
    price: 149,
    interval: "yearly",
    description: "Annual top directory spotlight with verified founder badge",
  },
];

export function PayPalPayIn4Calculator({
  initialAmount,
  currency = "USD",
  currencySymbol = "$",
  plans,
  selectedPlanId,
  siteId = "aitoolshubi-com",
  merchantName = "AItools Hubi",
  onCheckout,
  className = "",
  compact = false,
}: PayPalPayIn4CalculatorProps) {
  // Normalize plans to ensure prices are numbers
  const normalizedPlans = useMemo(() => {
    const raw = plans && plans.length > 0 ? plans : DEFAULT_HUBI_PLANS;
    return raw.map((p) => ({
      id: p.id,
      name: p.name,
      price: typeof p.price === "number" ? p.price : parseFloat(String(p.price)) || 49,
      interval: p.interval || "monthly",
      description: p.description,
    }));
  }, [plans]);

  // Determine initial selected plan and price
  const initialPlan = useMemo(() => {
    if (selectedPlanId) {
      const match = normalizedPlans.find((p) => p.id === selectedPlanId);
      if (match) return match;
    }
    if (initialAmount) {
      const match = normalizedPlans.find((p) => Math.abs(p.price - initialAmount) < 0.01);
      if (match) return match;
    }
    // Default to Premium Partner ($49) or first plan >= 30
    return normalizedPlans.find((p) => p.price >= 30) || normalizedPlans[0];
  }, [normalizedPlans, selectedPlanId, initialAmount]);

  const [activePlan, setActivePlan] = useState<PayIn4Plan | null>(initialPlan || null);
  const [amount, setAmount] = useState<number>(() => {
    if (initialAmount && initialAmount >= 30) return initialAmount;
    if (initialPlan) return initialPlan.price;
    return 49;
  });

  // Keep in sync if initialAmount or selectedPlanId changes
  useEffect(() => {
    if (initialAmount && initialAmount >= 30) {
      setAmount(initialAmount);
      const match = normalizedPlans.find((p) => Math.abs(p.price - initialAmount) < 0.01);
      if (match) setActivePlan(match);
    }
  }, [initialAmount, normalizedPlans]);

  const isEligible = amount >= 30 && amount <= 1500;
  const installmentAmount = (amount / 4).toFixed(2);

  // Compute 4 bi-weekly dates from today
  const paymentDates = useMemo(() => {
    const now = new Date();
    const dates = [];
    for (let i = 0; i < 4; i++) {
      const d = new Date(now.getTime() + i * 14 * 24 * 60 * 60 * 1000);
      dates.push({
        step: i + 1,
        title: i === 0 ? "Today" : `In ${i * 2} weeks`,
        dateStr: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        percent: "25%",
        amount: installmentAmount,
      });
    }
    return dates;
  }, [installmentAmount]);

  const handleSelectPlan = (p: { id: string; name: string; price: number; interval?: string }) => {
    setActivePlan(p);
    setAmount(p.price);
  };

  const handleSliderChange = (vals: number[]) => {
    const val = vals[0];
    setAmount(val);
    const matched = normalizedPlans.find((p) => Math.abs(p.price - val) < 0.01);
    setActivePlan(matched || null);
  };

  const handleCheckoutClick = () => {
    if (!onCheckout) return;
    onCheckout({
      planName: activePlan ? activePlan.name : `Pay in 4 Order (${currencySymbol}${amount})`,
      amount: amount.toFixed(2),
      currency,
      tier: (activePlan?.id as any) || "featured",
      planId: activePlan?.id || "custom-pay-in-4",
      siteId,
      isPayIn4: true,
    });
  };

  return (
    <div
      className={`rounded-2xl border border-blue-500/25 bg-gradient-to-br from-card via-card to-blue-500/5 p-4 sm:p-5 shadow-xl backdrop-blur-md text-foreground ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-blue-600/15 text-blue-500 flex items-center justify-center font-black shadow-inner">
            <span className="text-sm font-black text-[#0070ba] dark:text-[#009cde]">P4</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold tracking-tight">PayPal Pay Later estimate</span>
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-black"
              >
                Check at PayPal
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Illustrative 4-part split for {merchantName}; PayPal decides availability and terms at checkout
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/40 px-2 py-1 rounded-md border border-border/40">
          <ShieldCheck className="h-3 w-3 text-emerald-500" />
          <span>Eligibility varies</span>
        </div>
      </div>

      {/* Main Breakdown Display */}
      <div className="my-4 rounded-xl bg-blue-500/5 border border-blue-500/20 p-4 text-center">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
          {activePlan ? activePlan.name : "Custom Order"} · Bi-Weekly Payment
        </div>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-3xl sm:text-4xl font-extrabold text-[#0070ba] dark:text-[#38bdf8] tracking-tight">
            {currencySymbol}
            {installmentAmount}
          </span>
          <span className="text-xs sm:text-sm text-muted-foreground font-medium">/ every 2 weeks</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Total of{" "}
          <strong className="text-foreground">
            {currencySymbol}
            {amount.toFixed(2)} {currency}
          </strong>{" "}
          split into 4 equal payments over 6 weeks.
        </p>
      </div>

      {/* Verified Catalog Plan Presets */}
      {normalizedPlans && normalizedPlans.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Select Verified Catalog Plan:
            </label>
            <span className="text-[10px] text-blue-500 font-medium">Studio Catalog Synchronized</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {normalizedPlans.map((p) => {
              const isSelected = activePlan?.id === p.id || Math.abs(amount - p.price) < 0.01;
              const pSplit = (p.price / 4).toFixed(2);
              const planEligible = p.price >= 30;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPlan(p)}
                  className={`rounded-xl border p-2 text-left transition-all ${
                    isSelected
                      ? "border-blue-500 bg-blue-500/10 shadow-sm ring-1 ring-blue-500/50"
                      : "border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-border"
                  }`}
                >
                  <div className="text-[11px] font-bold truncate text-foreground">{p.name}</div>
                  <div className="text-xs font-extrabold text-[#0070ba] dark:text-[#38bdf8] mt-0.5">
                    {currencySymbol}
                    {p.price}
                    <span className="text-[10px] text-muted-foreground font-normal"> / {p.interval || "mo"}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {planEligible ? `4x ${currencySymbol}${pSplit}` : "Single checkout"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Interactive Slider */}
      <div className="mb-5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">Adjust Amount ($30 – $500):</span>
          <div className="flex items-center gap-1 font-mono font-bold text-foreground bg-muted/40 px-2 py-0.5 rounded border border-border/50">
            <span>{currencySymbol}</span>
            <span>{amount}</span>
          </div>
        </div>
        <Slider
          value={[amount]}
          onValueChange={handleSliderChange}
          min={30}
          max={300}
          step={1}
          className="w-full py-2 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
          <span>{currencySymbol}30 (Min Pay in 4)</span>
          <span>{currencySymbol}99 (Lifetime)</span>
          <span>{currencySymbol}149 (Annual)</span>
          <span>{currencySymbol}300 max</span>
        </div>
      </div>

      {/* Visual Timeline (4 Steps) */}
      <div className="mb-4">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
          Payment Schedule:
        </div>
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {paymentDates.map((item, idx) => (
            <div
              key={item.step}
              className={`rounded-lg p-2 text-center border relative transition-all ${
                idx === 0
                  ? "bg-blue-500/10 border-blue-500/30 text-foreground"
                  : "bg-muted/20 border-border/40 text-muted-foreground"
              }`}
            >
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                {item.title}
              </div>
              <div className="text-xs sm:text-sm font-extrabold text-foreground mt-0.5">
                {currencySymbol}
                {item.amount}
              </div>
              <div className="text-[10px] text-muted-foreground/80 mt-0.5">{item.dateStr}</div>
              {idx === 0 && (
                <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                  Due Now
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Perks / Fine Print Badges */}
      <div className="grid grid-cols-3 gap-2 py-3 border-y border-border/40 text-center mb-4">
        <div>
          <div className="text-xs font-bold text-foreground flex items-center justify-center gap-1">
            <Percent className="h-3 w-3 text-emerald-500" /> PayPal terms
          </div>
          <div className="text-[10px] text-muted-foreground">Shown at checkout</div>
        </div>
        <div>
          <div className="text-xs font-bold text-foreground flex items-center justify-center gap-1">
            <Zap className="h-3 w-3 text-amber-500" /> Availability
          </div>
          <div className="text-[10px] text-muted-foreground">Buyer eligibility applies</div>
        </div>
        <div>
          <div className="text-xs font-bold text-foreground flex items-center justify-center gap-1">
            <ShieldCheck className="h-3 w-3 text-blue-500" /> Review terms
          </div>
          <div className="text-[10px] text-muted-foreground">With PayPal</div>
        </div>
      </div>

      {/* Checkout Button */}
      {onCheckout && (
        <Button
          onClick={handleCheckoutClick}
          disabled={!isEligible}
          className="w-full bg-[#0070ba] hover:bg-[#005ea6] text-white font-bold h-10 shadow-md flex items-center justify-center gap-2 group transition-all"
        >
          <CreditCard className="h-4 w-4" />
          <span>
            Checkout 4x {currencySymbol}
            {installmentAmount} with PayPal
          </span>
          <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
        </Button>
      )}

      {/* Disclaimer */}
      <p className="text-[10px] text-muted-foreground text-center mt-2.5">
        Pay in 4 is available upon approval by PayPal for purchases of $30 to $1,500 USD. Terms may apply.
      </p>
    </div>
  );
}

interface PayPalPayIn4ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAmount?: number;
  currency?: string;
  plans?: PayIn4Plan[];
  selectedPlanId?: string;
  merchantName?: string;
  siteId?: string;
  onCheckout?: (planDetails: any) => void;
}

export function PayPalPayIn4Modal({
  open,
  onOpenChange,
  initialAmount,
  currency = "USD",
  plans,
  selectedPlanId,
  merchantName,
  siteId,
  onCheckout,
}: PayPalPayIn4ModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden bg-background border-border shadow-2xl">
        <DialogHeader className="sr-only">
            <DialogTitle>PayPal Pay Later estimate</DialogTitle>
          <DialogDescription>
            This is an illustrative split only. PayPal will show whether Pay Later is available and provide the final terms before approval.
          </DialogDescription>
        </DialogHeader>
        <PayPalPayIn4Calculator
          initialAmount={initialAmount}
          currency={currency}
          plans={plans}
          selectedPlanId={selectedPlanId}
          merchantName={merchantName}
          siteId={siteId}
          onCheckout={(details) => {
            onOpenChange(false);
            if (onCheckout) onCheckout(details);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
