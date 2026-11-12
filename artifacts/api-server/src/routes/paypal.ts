import { Router } from "express";
import { createHash } from "node:crypto";
import { requireAuth, optionalAuth, type AuthenticatedRequest } from "../lib/auth.js";
import {
  updatePartnerTierByOwner,
  updateUserSubscription,
  addPartnershipApplication,
  upsertUserProfile,
} from "../lib/db-fallback.js";
import { sendTransactionalEmail, buildPaymentReceiptEmailHtml, buildPaidListingActivatedEmailHtml } from "../lib/brevo.js";
import { logger } from "../lib/logger.js";
import { recordLiveCommerceEvent, getAnalytics, trackEvent } from "./paylo.js";
import { loadMerchantSites } from "../lib/site-crawler.js";
import { DEFAULT_PAYPAL_PLAN_IDS, getPayPalBase, getPayPalCredentials, getSandboxPayPalPlanIds, hasPayPalCredentials } from "../lib/paypal-runtime.js";

const router = Router();

function getPayPalApiBase(mode: "sandbox" | "live" = process.env["PAYPAL_MODE"] === "sandbox" ? "sandbox" : "live"): string {
  return getPayPalBase(mode);
}

function isPayPalConfigured(mode: "sandbox" | "live" = process.env["PAYPAL_MODE"] === "sandbox" ? "sandbox" : "live"): boolean {
  return hasPayPalCredentials(mode);
}

export const PAYPAL_PLAN_IDS: Record<string, string> = DEFAULT_PAYPAL_PLAN_IDS;

const pendingOrderToolMetadata = new Map<string, { toolMetadata?: any; customMetadata?: OrderCustomMetadata }>();

// The PayPal client ID is intentionally public. Serving it from the API lets
// the web app load the SDK at runtime instead of baking deployment-specific
// configuration into a static frontend build.
router.get(["/paypal/config", "/api/paypal/config"], async (_req, res) => {
  const credentials = getPayPalCredentials("sandbox");
  const clientId = credentials?.clientId || process.env["PAYPAL_CLIENT_ID"];
  const planIds = getSandboxPayPalPlanIds();

  if (!clientId || !isPayPalConfigured("sandbox")) {
    res.status(503).json({
      error: "A valid PayPal Sandbox app is not configured yet.",
      mode: "unconfigured",
      mock: false,
    });
    return;
  }
  const token = await getPayPalAccessToken("sandbox");
  if (!token) {
    res.status(503).json({ error: "PayPal Sandbox credentials could not be authenticated.", mode: "unavailable", mock: false });
    return;
  }
  res.json({
    clientId,
    currency: "USD",
    intent: "subscription",
    vault: true,
    mode: "sandbox",
    mock: false,
    planIds,
  });
});

export type SupportedTier = "community" | "featured" | "premium" | "lifetime" | "fast_track" | "spotlight";
export type SupportedInterval = "monthly" | "yearly" | "one-time";

function normalizeTier(value: unknown): SupportedTier | null {
  if (typeof value !== "string") return null;
  const v = value.toLowerCase().replace(/[- ]/g, "_").trim();
  if (v === "community" || v === "pro") return "community";
  if (v === "featured") return "featured";
  if (v === "premium") return "premium";
  if (v === "lifetime" || v === "vip" || v === "founding_pass") return "lifetime";
  if (v === "fast_track" || v === "fasttrack" || v === "fast") return "fast_track";
  if (v === "spotlight" || v === "launchpad") return "spotlight";
  return null;
}

function normalizeInterval(value: unknown): SupportedInterval | null {
  if (typeof value !== "string") return null;
  const v = value.toLowerCase().replace(/[_ ]/g, "-").trim();
  if (v === "monthly" || v === "month") return "monthly";
  if (v === "yearly" || v === "year") return "yearly";
  if (v === "one-time" || v === "onetime" || v === "once" || v === "lifetime") return "one-time";
  return null;
}

interface OrderCustomMetadata {
  tier: string;
  interval: string;
  email?: string;
  emailHash?: string;
  toolName?: string;
  website?: string;
  description?: string;
  category?: string;
  logoUrl?: string;
  pricingModel?: string;
  startingPrice?: string;
}

function parseOrderMetadata(capture: unknown): OrderCustomMetadata | null {
  const customId = (capture as { purchase_units?: Array<{ custom_id?: unknown }> })?.purchase_units?.[0]?.custom_id;
  if (typeof customId !== "string") return null;
  try {
    const parsed = JSON.parse(customId) as Record<string, unknown>;
    if (
      typeof parsed.tier !== "string" ||
      typeof parsed.interval !== "string" ||
      (typeof parsed.email !== "string" && typeof parsed.emailHash !== "string")
    ) return null;
    return {
      tier: parsed.tier,
      interval: parsed.interval,
      email: typeof parsed.email === "string" ? parsed.email.toLowerCase().trim() : undefined,
      emailHash: typeof parsed.emailHash === "string" ? parsed.emailHash : undefined,
      toolName: typeof parsed.toolName === "string" ? parsed.toolName : undefined,
      website: typeof parsed.website === "string" ? parsed.website : undefined,
      description: typeof parsed.description === "string" ? parsed.description : undefined,
      category: typeof parsed.category === "string" ? parsed.category : undefined,
      logoUrl: typeof parsed.logoUrl === "string" ? parsed.logoUrl : undefined,
      pricingModel: typeof parsed.pricingModel === "string" ? parsed.pricingModel : undefined,
      startingPrice: typeof parsed.startingPrice === "string" ? parsed.startingPrice : undefined,
    };
  } catch {
    return null;
  }
}

async function getPayPalAccessToken(mode: "sandbox" | "live" = process.env["PAYPAL_MODE"] === "sandbox" ? "sandbox" : "live"): Promise<string | null> {
  const credentials = getPayPalCredentials(mode);
  const clientId = credentials?.clientId;
  const clientSecret = credentials?.clientSecret;

  if (!clientId || !clientSecret) {
    return null;
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  try {
    const res = await fetch(`${getPayPalApiBase(mode)}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error({ status: res.status, error: errText }, "[paypal] Token fetch failed");
      return null;
    }

    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  } catch (err) {
    logger.error({ error: String(err) }, "[paypal] Exception fetching access token");
    return null;
  }
}

function getPlanPricing(tier: string = "community", interval: string = "monthly") {
  const isYearly = interval === "yearly";
  const rawTier = tier.toLowerCase().replace(/[- ]/g, "_");

  if (rawTier === "fast_track") {
    return {
      amount: "39.00",
      name: "Fast-Track Sponsored Listing",
      description: "AItools Hubi — Fast-Track Sponsored Directory Listing (One-Time)",
    };
  }

  if (rawTier === "spotlight") {
    return {
      amount: "129.00",
      name: "Founder Spotlight Launch & Newsletter Package",
      description: "AItools Hubi — 7-Day Homepage Hero Spotlight, Newsletter Feature & Social Broadcast (One-Time)",
    };
  }

  if (rawTier === "lifetime") {
    return {
      amount: "99.00",
      name: "Lifetime VIP Founding Pass",
      description: "AItools Hubi — Lifetime VIP Founding Pass (One-Time)",
    };
  }

  if (rawTier.includes("premium")) {
    return {
      amount: isYearly ? "399.00" : "49.00",
      name: "Premium Partner & Media Package",
      description: `AItools Hubi — Premium Partner Package (${isYearly ? "Yearly" : "Monthly"})`,
    };
  }

  if (rawTier.includes("featured")) {
    return {
      amount: isYearly ? "149.00" : "19.00",
      name: "Featured Partner Listing",
      description: `AItools Hubi — Featured Partner Listing (${isYearly ? "Yearly" : "Monthly"})`,
    };
  }

  // Community / Pro Member
  return {
    amount: isYearly ? "59.00" : "6.00",
    name: "Pro Community Member",
    description: `AItools Hubi — Pro Community Membership (${isYearly ? "Yearly · Save 18%" : "Monthly"})`,
  };
}

// POST /api/paypal/create-order
router.post(["/paypal/create-order", "/api/paypal/create-order"], optionalAuth, async (req: AuthenticatedRequest, res) => {
  const {
    tier,
    interval,
    email: bodyEmail,
    expectedAmount,
    expectedPlanName,
    siteId,
    catalogPlanId,
    toolMetadata,
  } = (req.body ?? {}) as {
    tier?: unknown;
    interval?: unknown;
    email?: string;
    expectedAmount?: string | number;
    expectedPlanName?: string;
    siteId?: string;
    catalogPlanId?: string;
    toolMetadata?: {
      toolName?: string;
      website?: string;
      description?: string;
      category?: string;
      logoUrl?: string;
      pricingModel?: string;
      startingPrice?: string;
    };
  };
  const selectedTier = normalizeTier(tier);
  const selectedInterval = normalizeInterval(interval);
  const isPayloSandboxCheckout = Boolean(siteId || catalogPlanId);
  const checkoutMode = isPayloSandboxCheckout ? "sandbox" : (process.env["PAYPAL_MODE"] === "sandbox" ? "sandbox" : "live");
  if (!selectedTier || !selectedInterval) {
    res.status(400).json({ error: "Invalid checkout plan." });
    return;
  }
  if (!isPayPalConfigured(checkoutMode)) {
    res.status(503).json({ error: "PayPal checkout is not configured yet." });
    return;
  }

  const email = (req.authUser?.email || bodyEmail || "buyer@aitoolshubi.com").toLowerCase().trim();
  const plan = getPlanPricing(selectedTier, selectedInterval);
  const merchantSite = siteId ? loadMerchantSites().find((site) => site.id === siteId) : undefined;
  const catalogPlan = catalogPlanId ? merchantSite?.pricingPlans.find((item) => item.id === catalogPlanId) : undefined;

  // This release processes checkout only for the configured demo merchant.
  if (siteId || catalogPlanId) {
    if (!["aitoolshubi", "aitoolshubi-com"].includes(siteId || "") || !catalogPlanId) {
      res.status(403).json({ error: "This PayPal checkout is configured for the AItools Hubi Sandbox demo only." });
      return;
    }
    const planHasSupportedTier = catalogPlan && (
      (selectedTier === "community" && /community|pro/i.test(`${catalogPlan.id} ${catalogPlan.name}`)) ||
      (selectedTier === "featured" && /featured|partner/i.test(`${catalogPlan.id} ${catalogPlan.name}`)) ||
      (selectedTier === "premium" && /premium/i.test(`${catalogPlan.id} ${catalogPlan.name}`)) ||
      (selectedTier === "lifetime" && /lifetime|vip|founding pass/i.test(`${catalogPlan.id} ${catalogPlan.name}`) && catalogPlan.interval === "one-time")
    );
    if (
      !catalogPlan || !planHasSupportedTier || catalogPlan.interval !== selectedInterval ||
      Number(catalogPlan.price).toFixed(2) !== plan.amount || merchantSite?.currency !== "USD"
    ) {
      res.status(409).json({ error: "The selected plan is not an active, price-matched AItools Hubi Sandbox plan." });
      return;
    }
    // Paylo's judge-facing path must always be a PayPal Sandbox order. Do not
    // turn a local mock into a checkout that looks like buyer approval.
    if (!isPayPalConfigured("sandbox")) {
      res.status(503).json({ error: "Paylo Sandbox checkout needs valid Sandbox app credentials on the API server." });
      return;
    }
  }
  if (expectedAmount !== undefined && Number(expectedAmount).toFixed(2) !== plan.amount) {
    const matchesCatalogAmount = catalogPlan && Number(catalogPlan.price).toFixed(2) === Number(expectedAmount).toFixed(2);
    if (!matchesCatalogAmount) {
      res.status(409).json({ error: "The selected price no longer matches the merchant plan. Review the updated checkout details and try again." });
      return;
    }
  }
  if (expectedPlanName) {
    const normExpected = expectedPlanName.trim().toLowerCase().replace(/[-_()]/g, " ");
    const normPlan = plan.name.toLowerCase().replace(/[-_()]/g, " ");
    const normCatalog = (catalogPlan?.name || "").toLowerCase().replace(/[-_()]/g, " ");
    const matches =
      normExpected === normPlan ||
      normExpected.includes(normPlan) ||
      normPlan.includes(normExpected) ||
      (normCatalog && (normExpected === normCatalog || normExpected.includes(normCatalog) || normCatalog.includes(normExpected)));
    if (!matches) {
      res.status(409).json({ error: "The selected plan no longer matches the merchant catalog. Refresh the page and choose again." });
      return;
    }
  }
  const token = await getPayPalAccessToken(checkoutMode);

  if (!token) {
    res.status(503).json({ error: "PayPal checkout is unavailable. Please try again shortly." });
    return;
  }

  const customMetadata: OrderCustomMetadata = {
    tier: selectedTier,
    interval: selectedInterval,
    email,
    toolName: toolMetadata?.toolName,
    website: toolMetadata?.website,
    description: toolMetadata?.description,
    category: toolMetadata?.category,
    logoUrl: toolMetadata?.logoUrl,
    pricingModel: toolMetadata?.pricingModel,
    startingPrice: toolMetadata?.startingPrice,
  };

  try {
    // PayPal strict schema limit: purchase_units[0].custom_id must NOT exceed 127 characters.
    const compactPayload = {
      tier: selectedTier,
      interval: selectedInterval,
      emailHash: createHash("sha256").update(email).digest("hex"),
    };
    const customIdStr = JSON.stringify(compactPayload);
    if (customIdStr.length > 127) {
      res.status(400).json({ error: "Checkout metadata is too long to verify safely." });
      return;
    }

    const orderRes = await fetch(`${getPayPalApiBase(checkoutMode)}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            description: plan.description.slice(0, 127),
            custom_id: customIdStr,
            amount: {
              currency_code: "USD",
              value: plan.amount,
            },
          },
        ],
        application_context: {
          brand_name: "AItools Hubi",
          landing_page: "BILLING",
          user_action: "PAY_NOW",
          return_url: `${req.headers.origin || "http://localhost:5173"}/dashboard?tier=${selectedTier}&status=success`,
          cancel_url: `${req.headers.origin || "http://localhost:5173"}/dashboard?tier=${selectedTier}&status=cancelled`,
        },
      }),
    });

    if (!orderRes.ok) {
      const errData = await orderRes.text();
      logger.error({ status: orderRes.status, error: errData }, "[paypal] Order creation failed");
      res.status(orderRes.status).json({ error: "PayPal order creation failed" });
      return;
    }

    const orderData = (await orderRes.json()) as { id?: string; status?: string };
    if (orderData.id) {
      pendingOrderToolMetadata.set(orderData.id, {
        toolMetadata,
        customMetadata,
      });
      // Auto-evict cache after 2 hours
      setTimeout(() => {
        if (orderData.id) pendingOrderToolMetadata.delete(orderData.id);
      }, 2 * 60 * 60 * 1000);
    }
    res.json({ ...orderData, amount: plan.amount, currency: "USD", planName: plan.name, interval: selectedInterval });
  } catch (err) {
    logger.error({ error: String(err) }, "[paypal] Exception creating order");
    res.status(500).json({ error: "Failed to create PayPal order" });
  }
});

// POST /api/paypal/capture-order
router.post(["/paypal/capture-order", "/api/paypal/capture-order"], optionalAuth, async (req: AuthenticatedRequest, res) => {
  const {
    orderId,
    tier,
    interval,
    email: bodyEmail,
    siteId,
    catalogPlanId,
    toolMetadata: bodyToolMeta,
  } = (req.body ?? {}) as {
    orderId: string;
    tier?: unknown;
    interval?: unknown;
    email?: string;
    siteId?: string;
    catalogPlanId?: string;
    toolMetadata?: {
      toolName?: string;
      website?: string;
      description?: string;
      category?: string;
      logoUrl?: string;
      pricingModel?: string;
      startingPrice?: string;
    };
  };

  const selectedTier = normalizeTier(tier);
  const selectedInterval = normalizeInterval(interval);
  const checkoutMode = (siteId || catalogPlanId) ? "sandbox" : (process.env["PAYPAL_MODE"] === "sandbox" ? "sandbox" : "live");
  if (!orderId || !selectedTier || !selectedInterval) {
    res.status(400).json({ error: "orderId is required" });
    return;
  }

  const targetEmail = (req.authUser?.email || bodyEmail || "buyer@aitoolshubi.com").toLowerCase().trim();
  const isLaunchTier = selectedTier === "fast_track" || selectedTier === "spotlight";
  const assignedRole = isLaunchTier || selectedTier.includes("featured") || selectedTier.includes("premium") ? "partner" : "member";
  const assignedListingTier = selectedTier === "spotlight" || selectedTier.includes("premium") ? "premium" : "featured";
  const plan = getPlanPricing(selectedTier, selectedInterval);

  if (siteId && !["aitoolshubi", "aitoolshubi-com"].includes(siteId)) {
    res.status(501).json({ error: "Seller onboarding is not enabled in this Paylo demo. No payment was captured." });
    return;
  }

  if (siteId || catalogPlanId) {
    if (!["aitoolshubi", "aitoolshubi-com"].includes(siteId || "") || !catalogPlanId) {
      res.status(403).json({ error: "Paylo capture is restricted to the AItools Hubi Sandbox demo." });
      return;
    }
    const merchantSite = loadMerchantSites().find((site) => site.id === siteId) || loadMerchantSites().find((site) => site.id === "aitoolshubi-com");
    const catalogPlan = merchantSite?.pricingPlans.find((item) => item.id === catalogPlanId || item.name.toLowerCase() === String(req.body.planName || "").toLowerCase());
    
    // Validate catalog plan existence
    if (!catalogPlan) {
      res.status(409).json({ error: "The selected plan could not be verified in the merchant catalog." });
      return;
    }

    if (!isPayPalConfigured("sandbox")) {
      res.status(503).json({ error: "Paylo Sandbox checkout needs valid Sandbox app credentials on the API server." });
      return;
    }
    if (orderId.startsWith("PAYPAL-MOCK")) {
      res.status(409).json({ error: "A simulated order cannot be presented as a PayPal payment." });
      return;
    }
  }

  const token = await getPayPalAccessToken(checkoutMode);

  // Helper to auto-register tool listing upon successful payment
  const handleAutoPublishListing = async (meta?: OrderCustomMetadata | null) => {
    const cachedOrderData = pendingOrderToolMetadata.get(orderId);
    const activeToolName = meta?.toolName || bodyToolMeta?.toolName || cachedOrderData?.toolMetadata?.toolName || cachedOrderData?.customMetadata?.toolName;
    const activeWebsite = meta?.website || bodyToolMeta?.website || cachedOrderData?.toolMetadata?.website || cachedOrderData?.customMetadata?.website;
    const activeCategory = meta?.category || bodyToolMeta?.category || cachedOrderData?.toolMetadata?.category || cachedOrderData?.customMetadata?.category || "code";
    const activeLogo = meta?.logoUrl || bodyToolMeta?.logoUrl || cachedOrderData?.toolMetadata?.logoUrl || cachedOrderData?.customMetadata?.logoUrl || "";
    const activeDesc = meta?.description || bodyToolMeta?.description || cachedOrderData?.toolMetadata?.description || cachedOrderData?.customMetadata?.description || "";
    const activePricing = meta?.pricingModel || bodyToolMeta?.pricingModel || cachedOrderData?.toolMetadata?.pricingModel || cachedOrderData?.customMetadata?.pricingModel || "Freemium";
    const activeStartPrice = meta?.startingPrice || bodyToolMeta?.startingPrice || cachedOrderData?.toolMetadata?.startingPrice || cachedOrderData?.customMetadata?.startingPrice || "";

    if (activeToolName && activeWebsite) {
      const cleanUrl = activeWebsite.startsWith("http") ? activeWebsite : `https://${activeWebsite}`;
      const listingDescription = `${activeDesc}\nCategory: ${activeCategory}\nPricing: ${activePricing}\nStartingPrice: ${activeStartPrice}\nLogo: ${activeLogo}\nLaunchPackage: ${selectedTier}\nPaidFastTrack: true`;

      await addPartnershipApplication({
        companyName: activeToolName,
        toolName: activeToolName,
        website: cleanUrl,
        email: targetEmail,
        tier: assignedListingTier,
        description: listingDescription,
        status: "approved",
      }).catch((err) => logger.warn({ err }, "[paypal] Failed auto-registering partnership application"));

      await upsertUserProfile({
        email: targetEmail,
        role: "partner",
        subscriptionStatus: "active",
        toolName: activeToolName,
        companyName: activeToolName,
        avatarUrl: activeLogo || undefined,
      }).catch((err) => logger.warn({ err }, "[paypal] Failed updating user profile to partner"));
    }
  };

  if (!token) {
    res.status(503).json({ error: "PayPal checkout is unavailable. Please try again shortly." });
    return;
  }

  try {
    const captureRes = await fetch(
      `${getPayPalApiBase(checkoutMode)}/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!captureRes.ok) {
      const errText = await captureRes.text();
      logger.error({ status: captureRes.status, error: errText }, "[paypal] Order capture failed");
      res.status(captureRes.status).json({ error: "PayPal order capture failed" });
      return;
    }

    const captureData = (await captureRes.json()) as any;

    if (captureData.status === "COMPLETED") {
      const metadata = parseOrderMetadata(captureData);
      const purchaseUnit = captureData.purchase_units?.[0];
      const completedCapture = purchaseUnit?.payments?.captures?.find((item: any) => item.status === "COMPLETED");
      const paidCurrency = completedCapture?.amount?.currency_code;
      const paidAmount = completedCapture?.amount?.value;
      const emailMatches = metadata?.email
        ? metadata.email === targetEmail
        : metadata?.emailHash === createHash("sha256").update(targetEmail).digest("hex");
      if (!metadata || !emailMatches || metadata.tier !== selectedTier || metadata.interval !== selectedInterval) {
        logger.error({ orderId, targetEmail, metadata, selectedTier, selectedInterval }, "[paypal] Captured order metadata did not match checkout request");
        res.status(409).json({ error: "PayPal completed the payment, but its order details did not match this checkout. Contact support before retrying." });
        return;
      }
      if (paidCurrency !== "USD" || Number(paidAmount).toFixed(2) !== plan.amount) {
        logger.error({ orderId, paidCurrency, paidAmount, expectedAmount: plan.amount }, "[paypal] Captured amount did not match checkout price");
        res.status(409).json({ error: "PayPal completed the payment, but the captured amount did not match the displayed plan. Contact support before retrying." });
        return;
      }

      await updateUserSubscription(targetEmail, {
        subscriptionStatus: "active",
        role: assignedRole,
        priceId: `${selectedTier}-${selectedInterval}`,
        subscriptionId: orderId,
      });
      if (assignedRole === "partner") await updatePartnerTierByOwner(targetEmail, assignedListingTier as "featured" | "premium");

      // Auto-publish and unlock directory profile
      await handleAutoPublishListing(metadata);

      // Send automated payment receipt email to buyer
      sendTransactionalEmail({
        to: [{ email: targetEmail }],
        subject: `Receipt: ${plan.name} ($${plan.amount} USD) — AItools Hubi`,
        htmlContent: buildPaymentReceiptEmailHtml({
          email: targetEmail,
          orderId,
          planName: plan.name,
          amount: plan.amount,
          interval: selectedInterval,
          gateway: "PayPal Secure Checkout",
        }),
      }).catch(() => { });

      // Send partner onboarding approval email
      if (assignedRole === "partner") {
        const toolLabel = metadata?.toolName || bodyToolMeta?.toolName;
        sendTransactionalEmail({
          to: [{ email: targetEmail }],
          subject: toolLabel ? `${toolLabel} paid listing is active — AItools Hubi Launchpad` : `Your paid listing package is active — AItools Hubi Launchpad`,
          htmlContent: buildPaidListingActivatedEmailHtml({
            toolName: toolLabel,
            tier: selectedTier,
          }),
        }).catch(() => { });
      }

      // Record verified capture for Paylo analytics in complete harmony
      const targetSiteId = siteId || "aitoolshubi-com";
      const buyerIdentifier = targetEmail || (req.body?.payerEmail as string) || (req.body?.payerName as string) || "buyer@aitoolshubi.com";

      recordLiveCommerceEvent({
        siteId: targetSiteId,
        type: selectedInterval === "monthly" || selectedInterval === "yearly" ? "subscription" : "sale",
        amount: Number(paidAmount),
        currency: paidCurrency,
        buyer: buyerIdentifier,
        product: `${plan.name} (${selectedInterval})`,
        region: "Sandbox",
      });

      const analytics = getAnalytics(targetSiteId);
      analytics.completedOrders = (analytics.completedOrders || 0) + 1;
      analytics.totalTPV = Number((Number(analytics.totalTPV || 0) + Number(paidAmount)).toFixed(2));
      trackEvent(targetSiteId, "checkout_captured", `PayPal Sandbox: ${plan.name} (${paidCurrency} ${Number(paidAmount).toFixed(2)}) · ${buyerIdentifier}`);

      res.json({
        success: true,
        status: "COMPLETED",
        role: assignedRole,
        tier: selectedTier,
        interval: selectedInterval,
        amount: Number(paidAmount).toFixed(2),
        currency: paidCurrency,
        planName: plan.name,
        captureId: completedCapture.id,
        email: targetEmail,
        toolName: metadata?.toolName || bodyToolMeta?.toolName,
      });
    } else {
      res.status(400).json({ error: `PayPal payment not completed (status: ${captureData.status})` });
    }
  } catch (err) {
    logger.error({ error: String(err) }, "[paypal] Exception capturing order");
    res.status(500).json({ error: "Failed to capture PayPal payment" });
  }
});

// POST /api/paypal/activate-subscription — Verify and activate real recurring PayPal subscription
router.post(["/paypal/activate-subscription", "/api/paypal/activate-subscription"], optionalAuth, async (req: AuthenticatedRequest, res) => {
  const { subscriptionId, tier, interval, email: bodyEmail, siteId, catalogPlanId } = (req.body ?? {}) as {
    subscriptionId?: string;
    tier?: unknown;
    interval?: unknown;
    email?: string;
    siteId?: string;
    catalogPlanId?: string;
  };

  const selectedTier = normalizeTier(tier);
  const selectedInterval = normalizeInterval(interval);
  const checkoutMode = (siteId || catalogPlanId) ? "sandbox" : (process.env["PAYPAL_MODE"] === "sandbox" ? "sandbox" : "live");
  if (!subscriptionId || !selectedTier || !selectedInterval) {
    res.status(400).json({ error: "subscriptionId, tier, and interval are required" });
    return;
  }

  const targetEmail = (req.authUser?.email || bodyEmail || "subscriber@aitoolshubi.com").toLowerCase().trim();
  const assignedRole = selectedTier.includes("featured") || selectedTier.includes("premium") ? "partner" : "member";
  const plan = getPlanPricing(selectedTier, selectedInterval);
  if (siteId && !["aitoolshubi", "aitoolshubi-com"].includes(siteId)) {
    res.status(501).json({ error: "Seller onboarding is not enabled in this Paylo demo. No subscription was activated." });
    return;
  }

  if (siteId || catalogPlanId) {
    if (!["aitoolshubi", "aitoolshubi-com"].includes(siteId || "") || !catalogPlanId) {
      res.status(403).json({ error: "This PayPal subscription is configured for the AItools Hubi Sandbox demo only." });
      return;
    }
    const merchantSite = loadMerchantSites().find((site) => site.id === siteId);
    const catalogPlan = merchantSite?.pricingPlans.find((item) => item.id === catalogPlanId);
    const supportedTier = catalogPlan && (
      (selectedTier === "community" && /community|pro/i.test(`${catalogPlan.id} ${catalogPlan.name}`)) ||
      (selectedTier === "featured" && /featured|partner/i.test(`${catalogPlan.id} ${catalogPlan.name}`)) ||
      (selectedTier === "premium" && /premium/i.test(`${catalogPlan.id} ${catalogPlan.name}`))
    );
    if (!catalogPlan || !supportedTier || catalogPlan.interval !== selectedInterval || Number(catalogPlan.price).toFixed(2) !== plan.amount || merchantSite?.currency !== "USD") {
      res.status(409).json({ error: "The PayPal subscription does not match an active AItools Hubi Sandbox plan." });
      return;
    }
    if (!isPayPalConfigured("sandbox")) {
      res.status(503).json({ error: "Paylo Sandbox checkout needs valid Sandbox app credentials on the API server." });
      return;
    }
    if (subscriptionId.startsWith("PAYPAL-MOCK")) {
      res.status(409).json({ error: "A simulated subscription cannot be presented as a PayPal payment." });
      return;
    }
  }
  const token = await getPayPalAccessToken(checkoutMode);

  if (!token) {
    res.status(503).json({ error: "PayPal service is unavailable. Please try again shortly." });
    return;
  }

  try {
    const subRes = await fetch(
      `${getPayPalApiBase(checkoutMode)}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!subRes.ok) {
      const errText = await subRes.text();
      logger.error({ status: subRes.status, error: errText, subscriptionId }, "[paypal] Subscription fetch failed");
      res.status(subRes.status).json({ error: "PayPal subscription verification failed" });
      return;
    }

    const subData = (await subRes.json()) as { status?: string; plan_id?: string; subscriber?: { email_address?: string } };
    const subStatus = (subData.status || "").toUpperCase();
    const expectedPlanId = (checkoutMode === "sandbox" ? getSandboxPayPalPlanIds() : PAYPAL_PLAN_IDS)[`${selectedTier}-${selectedInterval}`];
    if (!expectedPlanId || subData.plan_id !== expectedPlanId) {
      logger.error({ subscriptionId, selectedTier, selectedInterval, expectedPlanId, actualPlanId: subData.plan_id }, "[paypal] Subscription plan did not match checkout request");
      res.status(409).json({ error: "The PayPal subscription is for a different plan than the one selected. Contact support before retrying." });
      return;
    }

    if (subStatus === "ACTIVE" || subStatus === "APPROVED") {
      await updateUserSubscription(targetEmail, {
        subscriptionStatus: "active",
        role: assignedRole,
        priceId: `${selectedTier}-${selectedInterval}`,
        subscriptionId,
      });

      if (assignedRole === "partner") {
        await updatePartnerTierByOwner(targetEmail, selectedTier as "featured" | "premium");
      }

      sendTransactionalEmail({
        to: [{ email: targetEmail }],
        subject: `Active Subscription: ${plan.name} ($${plan.amount} USD) — AItools Hubi`,
        htmlContent: buildPaymentReceiptEmailHtml({
          email: targetEmail,
          orderId: subscriptionId,
          planName: plan.name,
          amount: plan.amount,
          interval: selectedInterval,
          gateway: "PayPal Automatic Subscription",
        }),
      }).catch(() => { });

      if (assignedRole === "partner") {
        sendTransactionalEmail({
          to: [{ email: targetEmail }],
          subject: "Your Partner Plan Is Active — AItools Hubi",
          htmlContent: buildPaidListingActivatedEmailHtml({
            toolName: "Your Tool",
            tier: selectedTier,
          }),
        }).catch(() => { });
      }

      logger.info({ subscriptionId, targetEmail, tier: selectedTier }, "[paypal] Subscription activated successfully");

      // Record verified subscription for Paylo Studio live ledger & analytics
      const targetSiteId = (req.body?.siteId as string) || "aitoolshubi-com";
      const buyerIdentifier = targetEmail || "Sandbox subscriber";

      recordLiveCommerceEvent({
        siteId: targetSiteId,
        type: "subscription",
        amount: Number(plan.amount),
        currency: "USD",
        buyer: buyerIdentifier,
        product: `${plan.name} (${selectedInterval})`,
        region: "Sandbox",
      });

      const analytics = getAnalytics(targetSiteId);
      analytics.completedOrders = (analytics.completedOrders || 0) + 1;
      analytics.totalTPV = Number((Number(analytics.totalTPV || 0) + Number(plan.amount)).toFixed(2));
      trackEvent(targetSiteId, "subscription_activated", `PayPal Sandbox: ${plan.name} (USD ${Number(plan.amount).toFixed(2)}) · ${buyerIdentifier}`);

      res.json({
        success: true,
        status: "ACTIVE",
        role: assignedRole,
        tier: selectedTier,
        interval: selectedInterval,
        amount: plan.amount,
        planName: plan.name,
        subscriptionId,
        email: targetEmail,
      });
    } else {
      res.status(400).json({ error: `PayPal subscription status is not active (status: ${subStatus})` });
    }
  } catch (err) {
    logger.error({ error: String(err), subscriptionId }, "[paypal] Exception verifying subscription");
    res.status(500).json({ error: "Failed to verify PayPal subscription" });
  }
});

// POST /api/paypal/webhook
router.post("/paypal/webhook", async (req, res) => {
  try {
    const rawBody = typeof req.body === "string" ? req.body : req.body?.toString?.("utf-8") || "";
    const event = typeof req.body === "object" && !Buffer.isBuffer(req.body) ? req.body : JSON.parse(rawBody || "{}");
    const eventType = event.event_type;
    const resource = event.resource;

    logger.info({ eventType, id: event.id }, "[paypal-webhook] Event received");

    if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED" || eventType === "BILLING.SUBSCRIPTION.RE-ACTIVATED") {
      const subId = resource?.id;
      const subscriberEmail = resource?.subscriber?.email_address?.toLowerCase()?.trim();
      if (subscriberEmail) {
        await updateUserSubscription(subscriberEmail, {
          subscriptionStatus: "active",
          subscriptionId: subId,
        });
        logger.info({ subscriberEmail, subId }, "[paypal-webhook] Subscription activated via webhook");
      }
    } else if (
      eventType === "BILLING.SUBSCRIPTION.CANCELLED" ||
      eventType === "BILLING.SUBSCRIPTION.SUSPENDED" ||
      eventType === "BILLING.SUBSCRIPTION.EXPIRED"
    ) {
      const subscriberEmail = resource?.subscriber?.email_address?.toLowerCase()?.trim();
      if (subscriberEmail) {
        await updateUserSubscription(subscriberEmail, {
          subscriptionStatus: "canceled",
        });
        logger.info({ subscriberEmail }, "[paypal-webhook] Subscription canceled via webhook");
      }
    } else if (eventType === "PAYMENT.SALE.COMPLETED") {
      const subId = resource?.billing_agreement_id;
      logger.info({ subId, saleId: resource?.id }, "[paypal-webhook] Recurring payment sale completed");
    }

    res.json({ received: true });
  } catch (err) {
    logger.error({ err }, "[paypal-webhook] Webhook handling error");
    res.status(200).json({ received: true });
  }
});

export default router;
