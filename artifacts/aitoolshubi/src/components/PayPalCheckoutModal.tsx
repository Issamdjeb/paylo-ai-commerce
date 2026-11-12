import React, { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Zap, CheckCircle2, Lock, Loader2, CreditCard, BadgeCheck, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api-client";

declare global {
  interface Window {
    paypal?: any;
  }
}

let paypalSdkPromise: Promise<void> | null = null;
let currentSdkIntent: "subscription" | "capture" | null = null;

function loadPayPalSdk(clientId: string, isOneTime = false): Promise<void> {
  const desiredIntent = isOneTime ? "capture" : "subscription";
  const existingScript = document.getElementById("paypal-sdk") as HTMLScriptElement | null;
  
  if (existingScript && currentSdkIntent !== desiredIntent) {
    existingScript.remove();
    if (window.paypal) delete (window as any).paypal;
    paypalSdkPromise = null;
    currentSdkIntent = null;
  }

  if (window.paypal?.Buttons && currentSdkIntent === desiredIntent) return Promise.resolve();
  if (paypalSdkPromise && currentSdkIntent === desiredIntent) return paypalSdkPromise;

  currentSdkIntent = desiredIntent;
  paypalSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "paypal-sdk";
    script.async = true;
    script.src = isOneTime
      ? `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`
      : `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=subscription&vault=true`;
    script.onload = () => resolve();
    script.onerror = () => {
      paypalSdkPromise = null;
      currentSdkIntent = null;
      reject(new Error("PayPal SDK failed to load"));
    };
    document.head.appendChild(script);
  });

  return paypalSdkPromise;
}

export interface ToolCheckoutMetadata {
  toolName?: string;
  website?: string;
  description?: string;
  category?: string;
  logoUrl?: string;
  pricingModel?: string;
  startingPrice?: string;
}

interface PayPalCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fullPage?: boolean;
  planTier?: "community" | "featured" | "premium" | "lifetime" | "fast_track" | "spotlight" | "fast-track";
  plan?: string;
  planName?: string;
  price?: number;
  billingInterval?: "monthly" | "yearly" | "one-time";
  initialEmail?: string;
  toolMetadata?: ToolCheckoutMetadata;
  onSuccess?: () => void | Promise<void>;
  /** Set false when a parent must finish post-payment onboarding first. */
  redirectAfterSuccess?: boolean;
  onCheckoutEvent?: (event: "checkout_cancelled" | "checkout_failed") => void;
  fixedPlan?: boolean;
  /** Merchant site and catalog entry supplied by Paylo's verified checkout intent. */
  siteId?: string;
  catalogPlanId?: string;
  planDescription?: string;
  planFeatures?: string[];
  merchantName?: string;
}

export function PayPalCheckoutModal({
  open,
  onOpenChange,
  fullPage = false,
  planTier,
  plan,
  planName,
  price,
  billingInterval = "monthly",
  initialEmail,
  toolMetadata,
  onSuccess,
  redirectAfterSuccess = true,
  onCheckoutEvent,
  fixedPlan = false,
  siteId,
  catalogPlanId,
  planDescription,
  planFeatures,
  merchantName,
}: PayPalCheckoutModalProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [buttonsReady, setButtonsReady] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutMode, setCheckoutMode] = useState<"sandbox" | "live" | "unknown">("unknown");
  const [authenticationRequired, setAuthenticationRequired] = useState(false);
  const [renderNonce, setRenderNonce] = useState(0);
  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const isRenderedRef = useRef(false);
  const onCheckoutEventRef = useRef(onCheckoutEvent);
  onCheckoutEventRef.current = onCheckoutEvent;

  const [guestEmail, setGuestEmail] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [isEditingGuestEmail, setIsEditingGuestEmail] = useState(false);
  const normalizedInitialEmail = initialEmail?.trim().toLowerCase() || "";
  const hasValidInitialEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedInitialEmail);

  const activeEmail = useMemo(() => {
    if (user?.email) return user.email;
    if (isEditingGuestEmail) return "";
    if (emailConfirmed && guestEmail.includes("@")) return guestEmail.trim().toLowerCase();
    if (hasValidInitialEmail) return normalizedInitialEmail;
    try {
      const local = JSON.parse(localStorage.getItem("local_user_session") || "{}");
      if (local?.email) return local.email;
    } catch {}
    return "demo.shopper@paypal-sandbox.test";
  }, [user?.email, guestEmail, emailConfirmed, isEditingGuestEmail, hasValidInitialEmail, normalizedInitialEmail]);

  const [selectedInterval, setSelectedInterval] = useState<"monthly" | "yearly" | "one-time">(billingInterval);

  useEffect(() => {
    setSelectedInterval(billingInterval);
  }, [billingInterval]);

  useEffect(() => {
    if (!open || user?.email) return;

    const email = initialEmail?.trim().toLowerCase() || "";
    setGuestEmail(email);
    setEmailConfirmed(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    setIsEditingGuestEmail(false);
  }, [open, initialEmail, user?.email]);

  const rawKey = (planTier || plan || "").toLowerCase().replace(/[- ]/g, "_");
  const effectiveTier: "community" | "featured" | "premium" | "lifetime" | "fast_track" | "spotlight" =
    rawKey.includes("spotlight") || rawKey.includes("launchpad")
      ? "spotlight"
      : rawKey.includes("fast_track") || rawKey.includes("fasttrack") || rawKey.includes("fast")
      ? "fast_track"
      : rawKey.includes("premium")
      ? "premium"
      : rawKey.includes("lifetime") || rawKey.includes("vip") || rawKey.includes("founding_pass")
      ? "lifetime"
      : rawKey.includes("featured")
      ? "featured"
      : "community";

  const planNameLower = (planName || "").toLowerCase();
  const isOneTime =
    (effectiveTier === "fast_track" || effectiveTier === "spotlight" || effectiveTier === "lifetime" || billingInterval === "one-time") &&
    !planNameLower.includes("annual") &&
    !planNameLower.includes("yearly") &&
    !planNameLower.includes("month");
  const isYearly =
    !isOneTime && (
      selectedInterval === "yearly" ||
      billingInterval === "yearly" ||
      planNameLower.includes("annual") ||
      planNameLower.includes("yearly")
    );

  const PLAN_MAP = {
    fast_track: {
      name: "Fast-Track Sponsored Listing",
      price: "$39.00 one-time",
      amount: "39.00",
      badge: "Sponsored listing",
      features: [
        "Sponsored listing added after checkout",
        "Permanent directory listing with a clearly labeled sponsored link",
        "Clearly labeled sponsored placement",
        "Broadcast in 'Newly Launched' Feed & RSS",
        "Founder Analytics Console & Click Tracking",
      ],
    },
    spotlight: {
      name: "Founder Spotlight Launch & Newsletter Package",
      price: "$129.00 one-time",
      amount: "129.00",
      badge: "Hero Spotlight",
      features: [
        "Sponsored listing added after checkout",
        "7-Day Homepage Hero Top Spotlight Placement",
        "Dedicated feature in the weekly founder newsletter",
        "Social Media Broadcast on X/Twitter Community Feed",
        "Clearly labeled sponsored placement",
        "Click-through analytics for your listing",
      ],
    },
    community: {
      name: isYearly ? "Pro Community Member (Yearly · Save 18%)" : "Pro Community Member",
      price: isYearly ? "$59.00 / year" : "$6.00 / month",
      amount: isYearly ? "59.00" : "6.00",
      badge: isYearly ? "Save 18%" : "Popular",
      features: [
        "Unlimited Hubi AI Consulting & Prompt Architect",
        "Exclusive Member-only Tool Digests & Playbooks",
        "Tool Signals follows and practical product feedback",
        "Priority Early Access to New Software Releases",
      ],
    },
    featured: {
      name: isYearly ? "Featured Partner Listing (Yearly · Save 35%)" : "Featured Partner Listing",
      price: isYearly ? "$149.00 / year" : "$19.00 / month",
      badge: isYearly ? "Save 35%" : "Best ROI",
      amount: isYearly ? "149.00" : "19.00",
      features: [
        "Prominent sponsored directory placement",
        "Partner badge on your product card",
        "Click-through analytics for your listing",
        "Sponsored outbound link to your website",
      ],
    },
    premium: {
      name: isYearly ? "Premium Partner & Media Package (Yearly · Save 32%)" : "Premium Partner & Media Package",
      price: isYearly ? "$399.00 / year" : "$49.00 / month",
      badge: isYearly ? "Save 32%" : "Enterprise",
      amount: isYearly ? "399.00" : "49.00",
      features: [
        "Homepage hero carousel placement",
        "Dedicated Developer Newsletter Spotlight",
        "Direct Founder Support & Custom Promotion",
        "Full Analytics Dashboard & Monthly Impression Reports",
      ],
    },
    lifetime: {
      name: "Lifetime VIP Founding Pass",
      price: "$99.00 one-time",
      amount: "99.00",
      badge: "Lifetime access",
      features: [
        "Permanent founding member status",
        "Private founder community access",
        "One-time payment; no recurring subscription",
      ],
    },
  };

  const isCustomMerchant = siteId && !["aitoolshubi", "aitoolshubi-com"].includes(siteId);
  const displayMerchant = merchantName || (isCustomMerchant ? (siteId.charAt(0).toUpperCase() + siteId.slice(1)) : "AItools Hubi");
  const basePlanDetails = PLAN_MAP[effectiveTier] || PLAN_MAP.community;
  const planDetails = {
    ...basePlanDetails,
    amount: (fixedPlan && price !== undefined) ? price.toFixed(2) : basePlanDetails.amount,
    ...(fixedPlan && planName ? { name: planName } : {}),
    ...(fixedPlan && price !== undefined ? { price: `$${price.toFixed(2)} ${isOneTime ? "one-time" : isYearly ? "/ year" : "/ month"}` } : {}),
    ...(fixedPlan && planFeatures?.length ? { features: planFeatures } : {}),
  };

  const handleIntervalToggle = (newInterval: "monthly" | "yearly") => {
    if (newInterval === selectedInterval) return;
    isRenderedRef.current = false;
    setButtonsReady(false);
    setCheckoutError(null);
    setSelectedInterval(newInterval);
    setRenderNonce((n) => n + 1);
  };

  useEffect(() => {
    if (!open) {
      isRenderedRef.current = false;
      setButtonsReady(false);
      setLoading(false);
      setCheckoutError(null);
      setAuthenticationRequired(false);
      return;
    }

    if (authLoading || !activeEmail) {
      setButtonsReady(false);
      return;
    }

    let isMounted = true;

    const renderPayPalButtons = (planIds: Record<string, string> = {}) => {
      if (!isMounted) return;

      const container = paypalContainerRef.current;
      if (!container || isRenderedRef.current) return;

      if (!window.paypal?.Buttons) return;

      isRenderedRef.current = true;
      container.innerHTML = "";

      const isSubscription = !isOneTime;
      let subscriptionPlanId = "";

      if (isSubscription) {
        const planKey = `${effectiveTier}-${selectedInterval}`;
        subscriptionPlanId = planIds[planKey] || "";
        if (!subscriptionPlanId) {
          isRenderedRef.current = false;
          setCheckoutError(`The ${selectedInterval} subscription plan is not available right now. Please try again later or contact support.`);
          return;
        }
      }

      try {
        const buttonConfig: any = {
          style: {
            layout: "vertical",
            color: "gold",
            shape: "rect",
            label: isSubscription ? "subscribe" : "pay",
            height: 44,
          },
          onCancel: () => {
            setLoading(false);
            onCheckoutEventRef.current?.("checkout_cancelled");
            toast({
              title: "Checkout Cancelled",
              description: "You can resume checkout whenever you are ready.",
            });
          },
          onError: (err: any) => {
            setLoading(false);
            onCheckoutEventRef.current?.("checkout_failed");
            console.warn("PayPal SDK Note:", err);
            setCheckoutError(
              "PayPal checkout could not load. Confirm the Sandbox app is configured, then try again. No payment was made."
            );
          },
        };

        if (isSubscription) {
          // ── Real PayPal Subscription (Auto-recurring billing) ──
          buttonConfig.createSubscription = (_data: any, actions: any) => {
            setLoading(true);
            return actions.subscription.create({
              plan_id: subscriptionPlanId,
            });
          };

          buttonConfig.onApprove = async (data: { subscriptionID: string }) => {
            try {
              const userEmail = activeEmail || user?.email || "subscriber@aitoolshubi.com";
              const res = await apiFetch("/api/paypal/activate-subscription", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  subscriptionId: data.subscriptionID,
                  tier: effectiveTier,
                  interval: selectedInterval,
                  email: userEmail,
                  siteId,
                  catalogPlanId,
                }),
              });
              const result = await res.json();

              if (result.success) {
                const role = result.role || (effectiveTier === "community" ? "member" : "partner");

                const txnRecord = {
                  id: data.subscriptionID || `SUB-${Date.now().toString().slice(-6)}`,
                  date: new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
                  description: `${result.planName || planDetails.name} (Recurring Subscription)`,
                  amount: `$${result.amount || planDetails.amount}`,
                  interval: selectedInterval,
                  tier: effectiveTier,
                  status: "active",
                  gateway: "PayPal",
                };
                localStorage.setItem(`aitoolshubi_active_subscription_${userEmail}`, JSON.stringify(txnRecord));

                let prevTxns: any[] = [];
                try {
                  const rawTx = localStorage.getItem(`aitoolshubi_transactions_${userEmail}`);
                  prevTxns = rawTx && rawTx !== "undefined" && rawTx !== "null" ? JSON.parse(rawTx) : [];
                } catch { prevTxns = []; }
                localStorage.setItem(`aitoolshubi_transactions_${userEmail}`, JSON.stringify([txnRecord, ...prevTxns.filter((t: any) => t.id !== txnRecord.id)]));

                localStorage.setItem(
                  "local_user_session",
                  JSON.stringify({
                    email: userEmail,
                    role,
                    interval: selectedInterval,
                    planTier: effectiveTier,
                    planAmount: result.amount || planDetails.amount,
                    subscriptionStatus: "active",
                    id: data.subscriptionID,
                  })
                );

                toast({
                  title: "Subscription Activated",
                  description: `PayPal confirmed ${result.planName || planDetails.name} at $${result.amount || planDetails.amount} USD / ${selectedInterval}.`,
                });

                onOpenChange(false);
                if (onSuccess) await onSuccess();

                if (redirectAfterSuccess && !isCustomMerchant) {
                  setTimeout(() => {
                    setLocation(`/dashboard?tier=${effectiveTier}&status=activated`);
                  }, 1000);
                }
              } else {
                toast({
                  variant: "destructive",
                  title: "Subscription Error",
                  description: result.error || "Could not complete transaction.",
                });
              }
            } catch (err) {
              toast({
                variant: "destructive",
                title: "Processing Failed",
                description: String(err),
              });
            } finally {
              setLoading(false);
            }
          };
        } else {
          // ── One-time Order (Launchpad packages & immediate fast-track listings) ──
          buttonConfig.createOrder = async () => {
            setLoading(true);
            const userEmail = activeEmail || user?.email || "subscriber@aitoolshubi.com";
            const res = await apiFetch("/api/paypal/create-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tier: effectiveTier,
                interval: selectedInterval,
                email: userEmail,
                expectedAmount: price ?? planDetails.amount,
                  expectedPlanName: planName || planDetails.name,
                  siteId,
                  catalogPlanId,
                toolMetadata: toolMetadata || undefined,
              }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.id) {
              onCheckoutEventRef.current?.("checkout_failed");
              const needsFreshSignIn = res.status === 401;
              const message = needsFreshSignIn
                ? "Your session has expired. Sign in again to start secure checkout."
                : data.error || "We could not start secure checkout. Please try again.";
              setLoading(false);
              setAuthenticationRequired(needsFreshSignIn);
              setCheckoutError(message);
              throw new Error(message);
            }
            return data.id;
          };

          buttonConfig.onApprove = async (data: { orderID: string }) => {
            try {
              const userEmail = activeEmail || user?.email || "subscriber@aitoolshubi.com";
              const res = await apiFetch("/api/paypal/capture-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  orderId: data.orderID,
                  tier: effectiveTier,
                  interval: selectedInterval,
                  email: userEmail,
                  siteId,
                  catalogPlanId,
                  toolMetadata: toolMetadata || undefined,
                }),
              });
              const result = await res.json();

              if (result.success) {
                const role = result.role || (effectiveTier === "community" ? "member" : "partner");

                const txnRecord = {
                  id: data.orderID || `INV-${Date.now().toString().slice(-6)}`,
                  date: new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
                  description: result.planName || planDetails.name,
                  amount: `$${result.amount || planDetails.amount}`,
                  interval: selectedInterval,
                  tier: effectiveTier,
                  status: isOneTime ? "completed" : "active",
                  gateway: "PayPal",
                };
                if (!isOneTime) localStorage.setItem(`aitoolshubi_active_subscription_${userEmail}`, JSON.stringify(txnRecord));

                let prevTxns: any[] = [];
                try {
                  const rawTx = localStorage.getItem(`aitoolshubi_transactions_${userEmail}`);
                  prevTxns = rawTx && rawTx !== "undefined" && rawTx !== "null" ? JSON.parse(rawTx) : [];
                } catch { prevTxns = []; }
                localStorage.setItem(`aitoolshubi_transactions_${userEmail}`, JSON.stringify([txnRecord, ...prevTxns.filter((t: any) => t.id !== txnRecord.id)]));

                localStorage.setItem(
                  "local_user_session",
                  JSON.stringify({
                    email: userEmail,
                    role,
                    interval: selectedInterval,
                    planTier: effectiveTier,
                    planAmount: result.amount || planDetails.amount,
                    subscriptionStatus: isOneTime ? "completed" : "active",
                    id: `paypal-cust-${Date.now()}`
                  })
                );

                toast({
                  title: isOneTime ? "Payment Confirmed" : "Subscription Confirmed",
                  description: `${result.planName || planDetails.name} · $${result.amount || planDetails.amount} ${result.currency || "USD"}. PayPal confirmed this ${isOneTime ? "payment" : "subscription"}.`,
                });

                onOpenChange(false);
                if (onSuccess) await onSuccess();

                if (redirectAfterSuccess && !isCustomMerchant) {
                  setTimeout(() => {
                    setLocation(`/dashboard?tier=${effectiveTier}&status=activated`);
                  }, 1000);
                }
              } else {
                onCheckoutEventRef.current?.("checkout_failed");
                toast({
                  variant: "destructive",
                  title: "Payment Error",
                  description: result.error || "Could not complete transaction.",
                });
              }
            } catch (err) {
              onCheckoutEventRef.current?.("checkout_failed");
              toast({
                variant: "destructive",
                title: "Processing Failed",
                description: String(err),
              });
            } finally {
              setLoading(false);
            }
          };
        }

        window.paypal
          .Buttons(buttonConfig)
          .render(container)
          .then(() => {
            if (isMounted) setButtonsReady(true);
          })
          .catch((err: any) => {
            console.error("PayPal Button Render Error:", err);
            if (isMounted) setCheckoutError("PayPal could not show its payment options. Please try again.");
          });
      } catch (err) {
        console.error("PayPal SDK Exception:", err);
        setCheckoutError("PayPal could not start. Please try again.");
      }
    };

    void (async () => {
      try {
        const selectedPrice = Number(price);
        if (fixedPlan && price !== undefined && (!Number.isFinite(selectedPrice) || selectedPrice.toFixed(2) !== planDetails.amount)) {
          throw new Error("The selected price does not match the PayPal plan. Close checkout and choose the plan again.");
        }
        const configResponse = await apiFetch("/api/paypal/config");
        const config = await configResponse.json().catch(() => ({}));
        if (!configResponse.ok || !config.clientId) {
          throw new Error(config.error || "PayPal checkout is not configured yet.");
        }
        setCheckoutMode(config.mode === "sandbox" ? "sandbox" : "live");
        if (isCustomMerchant) {
          if (isMounted) {
            setButtonsReady(true);
            setCheckoutError(null);
          }
        } else {
          await loadPayPalSdk(config.clientId, isOneTime);
          if (isMounted) renderPayPalButtons(config.planIds || {});
        }
      } catch (error) {
        if (isMounted) {
          setCheckoutError(error instanceof Error ? error.message : "PayPal could not load. Check your connection, then try again.");
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [open, effectiveTier, selectedInterval, user?.email, authLoading, activeEmail, redirectAfterSuccess, onSuccess, renderNonce, price, fixedPlan]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={fullPage
        ? "fixed inset-0 !left-0 !top-0 !translate-x-0 !translate-y-0 !w-screen !max-w-none h-screen max-h-screen overflow-x-hidden overflow-y-auto rounded-none border-0 bg-background p-0 text-foreground shadow-2xl gap-0"
        : "w-[calc(100vw-20px)] sm:max-w-[1080px] max-h-[94vh] overflow-y-auto border-border bg-background text-foreground p-0 shadow-2xl rounded-3xl gap-0"
      }>
        <div className="hidden p-5 pb-4 sm:p-7">
          <DialogHeader className="space-y-3 text-left">
          <div className="flex items-center justify-between">
            <Badge className="bg-primary/20 text-primary border-primary/30 uppercase text-[10px] tracking-wider font-extrabold px-2.5 py-0.5">
              {planDetails.badge}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
              <Lock className="h-3.5 w-3.5 text-blue-400" /> PayPal-hosted checkout
            </span>
          </div>
          <DialogTitle className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary shrink-0" /> {planDetails.name}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Review the plan and billing terms before PayPal asks you to approve.
          </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid min-h-full min-w-0 border-t border-border md:grid-cols-2">
          {/* Official PayPal SDK Container */}
          <div className="order-2 min-w-0 p-6 sm:p-10 md:order-1 md:flex md:flex-col md:justify-center md:px-[8%] space-y-5">
            <div className="space-y-3">
              {checkoutMode === "sandbox" && (
                <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  PayPal Sandbox — test payment only; no real funds will move.
                </div>
              )}
              <Badge className="bg-primary/20 text-primary border-primary/30 uppercase text-[10px] tracking-wider font-extrabold px-2.5 py-0.5">
                {planDetails.badge}
              </Badge>
              <DialogTitle className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-primary shrink-0" /> Secure checkout
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {isOneTime
                  ? "Review this one-time payment in PayPal before approving it."
                  : "Review the plan and billing schedule in PayPal before approving. Nothing is charged until you approve."}
              </DialogDescription>
            </div>

            {/* Launch Tool Metadata Badge (if launching a product) */}
            {toolMetadata?.toolName && (
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/80 text-xs shadow-sm">
                {toolMetadata.logoUrl ? (
                  <img src={toolMetadata.logoUrl} alt={toolMetadata.toolName} className="w-9 h-9 rounded-xl object-contain border border-border/50 bg-background/80 p-0.5" />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center border border-primary/20">
                    {toolMetadata.toolName[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-foreground truncate">{toolMetadata.toolName}</p>
                    <Badge variant="outline" className="text-[10px] h-4 px-1 text-primary border-primary/30">Listing</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{toolMetadata.website}</p>
                </div>
              </div>
            )}

            {/* Billing Cycle Switcher or One-Time Badge */}
            {isOneTime ? (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">One-Time Launch Fee</span>
                </div>
                <Badge className="bg-primary/20 text-primary border-primary/30 text-xs font-black">
                  No Recurring Subscription
                </Badge>
              </div>
            ) : !fixedPlan ? (
              <div className="flex items-center justify-between p-2 rounded-2xl bg-muted/40 border border-border">
                <span className="text-xs text-muted-foreground font-semibold pl-2">Billing Cycle:</span>
                <div className="inline-flex p-1 rounded-xl bg-background border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => handleIntervalToggle("monthly")}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      selectedInterval === "monthly"
                        ? "bg-muted text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => handleIntervalToggle("yearly")}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedInterval === "yearly"
                        ? "bg-primary text-primary-foreground shadow-sm font-black"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>Yearly</span>
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-black">
                      {effectiveTier === "featured" ? "Save 35%" : effectiveTier === "premium" ? "Save 32%" : "Save 18%"}
                    </span>
                  </button>
                </div>
              </div>
            ) : null}

            <div>
              <p className="text-sm font-bold text-foreground">Choose how to pay</p>
              <p className="text-xs text-muted-foreground mt-1">PayPal securely processes cards and recurring subscriptions.</p>
            </div>

          {authLoading ? (
            <div className="min-h-[180px] flex items-center justify-center text-xs font-semibold text-muted-foreground rounded-2xl border border-border bg-muted/30">
              <Loader2 className="h-5 w-5 animate-spin text-primary mr-2.5" /> Checking account…
            </div>
          ) : !activeEmail ? (
            <div className="rounded-2xl border border-border bg-muted/30 p-5 space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">Where should we activate your plan & send your receipt?</p>
                <p className="text-xs text-muted-foreground">Instant checkout — no preliminary account creation required.</p>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (guestEmail && guestEmail.includes("@")) {
                    try {
                      localStorage.setItem(
                        "local_user_session",
                        JSON.stringify({
                          email: guestEmail.trim().toLowerCase(),
                          name: guestEmail.split("@")[0],
                          role: "member",
                        })
                      );
                    } catch {}
                    setEmailConfirmed(true);
                    setIsEditingGuestEmail(false);
                    setRenderNonce((n) => n + 1);
                  }
                }}
                className="space-y-3"
              >
                <input
                  type="email"
                  required
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="Enter your email (e.g. founder@company.com)"
                  className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <Button type="submit" className="w-full h-11 rounded-xl font-bold text-xs gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md cursor-pointer">
                  Continue to Card &amp; PayPal Checkout →
                </Button>
              </form>
              <div className="pt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Lock className="h-3 w-3 text-blue-400" /> Checkout hosted by PayPal
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setLocation(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
                  }}
                  className="text-primary hover:underline font-semibold cursor-pointer"
                >
                  Sign in with Google instead
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Active email confirmation banner */}
              <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-muted/40 border border-border text-xs">
                <span className="text-muted-foreground">
                  Activating plan for: <strong className="text-foreground">{activeEmail}</strong>
                </span>
                {!user?.email && (
                  <button
                    type="button"
                    onClick={() => {
                      setEmailConfirmed(false);
                      setIsEditingGuestEmail(true);
                      isRenderedRef.current = false;
                      setButtonsReady(false);
                    }}
                    className="text-primary hover:underline font-semibold text-[11px] cursor-pointer"
                  >
                    Change
                  </button>
                )}
              </div>

              {/* Official PayPal SDK Buttons Container */}
              <div className="space-y-3">
                <div className="p-3 rounded-2xl bg-gradient-to-r from-card via-muted/30 to-card border border-border space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-bold text-foreground">
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="h-4 w-4 text-primary" /> Pay by Card or PayPal
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border font-bold">VISA</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border font-bold">MC</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border font-bold">AMEX</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Click <strong>"PayPal"</strong> or <strong>"Debit or Credit Card"</strong> below to complete checkout through the official PayPal sandbox.
                  </p>
                </div>

                <div
                  key={`paypal-${effectiveTier}-${selectedInterval}-${renderNonce}`}
                  ref={paypalContainerRef}
                  className="w-full min-h-[46px] overflow-visible"
                />
                {!buttonsReady && !checkoutError && (
                  <div className="flex items-center justify-center gap-2.5 text-xs font-semibold text-muted-foreground py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading PayPal Sandbox options...
                  </div>
                )}

                {checkoutError && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-destructive">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Checkout Notice</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{checkoutError}</p>
                  </div>
                )}

                {/* PayPal Sandbox Reference Info */}
                <div className="p-3 rounded-xl border border-border bg-muted/20 space-y-2 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                      Official PayPal Sandbox Environment
                    </span>
                    <Badge variant="outline" className="text-[9px] font-mono border-blue-500/30 text-blue-500">
                      Sandbox Active
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-[10px]">
                    Approve the transaction in PayPal Sandbox with a test buyer account. Paylo never collects card details.
                  </p>
                </div>
              </div>
            </div>
          )}

            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { icon: Lock, label: "PayPal checkout" },
                { icon: ShieldCheck, label: "Review before approval" },
                { icon: CreditCard, label: "Payment options by region" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-2 py-2.5 text-center">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] leading-tight text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-center text-muted-foreground font-medium">
              Payment completes only after PayPal confirms approval.
            </p>
          </div>

          <aside className="relative order-1 min-w-0 min-h-[460px] overflow-hidden border-b border-border md:order-2 md:min-h-[calc(100vh-2px)] md:border-b-0 md:border-l">
            <img
              src="/earth-at-night.jpg"
              alt="Earth at night seen from orbit"
              className="absolute inset-0 h-full w-full object-cover object-[58%_center] opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-background/30 via-background/20 to-background/95" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,hsl(var(--primary)/0.2),transparent_36%)]" />
            <div className="relative flex h-full min-h-[460px] flex-col justify-between p-7 sm:p-10">
              <div className="mb-auto flex items-center gap-2 pt-1 text-xs font-bold text-foreground">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background font-black">
                  {displayMerchant.charAt(0).toUpperCase()}
                </span>
                {displayMerchant}
              </div>
              <div className="max-w-lg space-y-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                  {isCustomMerchant ? `${displayMerchant} Subscription` : "Your plan, at a glance"}
                </p>
                <div className="flex items-end justify-between gap-4">
                  <h3 className="text-3xl font-black leading-tight text-foreground sm:text-4xl">{planDetails.name}</h3>
                  <span className="shrink-0 text-lg font-black text-foreground">{planDetails.price}</span>
                </div>
                {fixedPlan && planDescription && <p className="text-sm leading-relaxed text-foreground/75">{planDescription}</p>}
                <div className="space-y-3 border-t border-foreground/20 pt-5">
                  {planDetails.features.map((feat, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs font-medium leading-relaxed text-foreground/90 sm:text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2.5 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs leading-relaxed text-foreground/90 backdrop-blur-md">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                  <span>
                    {isOneTime
                      ? "Your launch package is activated after payment. A receipt is sent to the email shown in checkout."
                      : "Your plan activates after payment. A receipt is sent to your account email."}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
