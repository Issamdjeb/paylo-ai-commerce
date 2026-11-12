import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { CrawledPricingPlan } from "./site-crawler.js";
import { DEFAULT_PAYPAL_PLAN_IDS, type PayPalPlanIds } from "./paypal-runtime.js";

const CACHE_FILE = path.resolve(process.cwd(), "data", "paylo-sandbox-subscriptions.json");

interface SandboxPlanCache {
  productId?: string;
  planIds: PayPalPlanIds;
}

function readCache(): SandboxPlanCache {
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8")) as Partial<SandboxPlanCache>;
    return { productId: parsed.productId, planIds: parsed.planIds || {} };
  } catch {
    return { planIds: {} };
  }
}

function writeCache(cache: SandboxPlanCache): void {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), { encoding: "utf-8", mode: 0o600 });
}

function planKey(plan: CrawledPricingPlan): string | null {
  if (plan.interval === "one-time") return null;
  const text = `${plan.id} ${plan.name}`.toLowerCase();
  const tier = /premium/.test(text) ? "premium" : /featured|partner/.test(text) ? "featured" : /community|pro/.test(text) ? "community" : null;
  return tier ? `${tier}-${plan.interval}` : null;
}

async function requestPayPal(pathname: string, accessToken: string, body?: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const response = await fetch(`https://api-m.sandbox.paypal.com${pathname}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(body === undefined ? {} : { "PayPal-Request-Id": `paylo-${randomUUID()}` }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(6000),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

function matchesExpectedPlan(plan: any, desired: CrawledPricingPlan): boolean {
  if (plan?.status !== "ACTIVE") return false;
  const expectedUnit = desired.interval === "yearly" ? "YEAR" : "MONTH";
  const cycle = Array.isArray(plan.billing_cycles)
    ? plan.billing_cycles.find((item: any) => item.tenure_type === "REGULAR")
    : null;
  const fixedPrice = cycle?.pricing_scheme?.fixed_price;
  return cycle?.frequency?.interval_unit === expectedUnit &&
    Number(fixedPrice?.value).toFixed(2) === Number(desired.price).toFixed(2) &&
    fixedPrice?.currency_code === "USD";
}

/** Verify reusable Sandbox plans and create missing subscription plans from the saved merchant catalog. */
export async function ensurePayPalSandboxSubscriptionPlans(
  accessToken: string,
  catalog: CrawledPricingPlan[]
): Promise<{ planIds: PayPalPlanIds; ready: string[]; missing: string[] }> {
  const cache = readCache();
  const planIds: PayPalPlanIds = {};
  const ready: string[] = [];
  const definitions = catalog.flatMap((plan) => {
    const key = planKey(plan);
    return key ? [{ key, plan }] : [];
  });

  for (const { key, plan } of definitions) {
    const candidates = [cache.planIds[key], DEFAULT_PAYPAL_PLAN_IDS[key]].filter((id): id is string => Boolean(id));
    let validId: string | undefined;
    for (const candidate of [...new Set(candidates)]) {
      const result = await requestPayPal(`/v1/billing/plans/${encodeURIComponent(candidate)}`, accessToken);
      if (result.ok && matchesExpectedPlan(result.data, plan)) {
        validId = candidate;
        break;
      }
    }

    if (!validId) {
      if (!cache.productId) {
        const productResult = await requestPayPal("/v1/catalogs/products", accessToken, {
          name: "Paylo AItools Hubi Sandbox Plans",
          description: "Sandbox billing catalog used by the Paylo hackathon demo.",
          type: "SERVICE",
        });
        if (!productResult.ok || typeof productResult.data?.id !== "string") continue;
        cache.productId = productResult.data.id;
        writeCache(cache);
      }

      const unit = plan.interval === "yearly" ? "YEAR" : "MONTH";
      const created = await requestPayPal("/v1/billing/plans", accessToken, {
        product_id: cache.productId,
        name: plan.name.slice(0, 127),
        description: plan.description.slice(0, 127),
        status: "ACTIVE",
        billing_cycles: [{
          frequency: { interval_unit: unit, interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: { fixed_price: { currency_code: "USD", value: Number(plan.price).toFixed(2) } },
        }],
        payment_preferences: { auto_bill_outstanding: true, setup_fee_failure_action: "CANCEL", payment_failure_threshold: 3 },
      });
      if (!created.ok || typeof created.data?.id !== "string" || !matchesExpectedPlan(created.data, plan)) continue;
      const createdPlanId = created.data.id;
      validId = createdPlanId;
      cache.planIds[key] = createdPlanId;
      writeCache(cache);
    }

    if (!validId) continue;
    planIds[key] = validId;
    ready.push(key);
  }

  return { planIds, ready, missing: definitions.map(({ key }) => key).filter((key) => !planIds[key]) };
}
