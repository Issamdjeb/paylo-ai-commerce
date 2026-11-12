/** Ephemeral credentials entered in Paylo Studio for the hackathon Sandbox demo.
 * Secrets stay in process memory only and are cleared whenever the API restarts.
 */
type PayPalCredentials = { clientId: string; clientSecret: string };
export type PayPalPlanIds = Record<string, string>;

let sandboxCredentials: PayPalCredentials | null = null;
let sandboxPlanIds: PayPalPlanIds | null = null;

export const DEFAULT_PAYPAL_PLAN_IDS: PayPalPlanIds = {
  "community-monthly": process.env["PAYPAL_PLAN_COMMUNITY_MONTHLY"] || "",
  "community-yearly": process.env["PAYPAL_PLAN_COMMUNITY_YEARLY"] || "",
  "featured-monthly": process.env["PAYPAL_PLAN_FEATURED_MONTHLY"] || "",
  "featured-yearly": process.env["PAYPAL_PLAN_FEATURED_YEARLY"] || "",
  "premium-monthly": process.env["PAYPAL_PLAN_PREMIUM_MONTHLY"] || "",
  "premium-yearly": process.env["PAYPAL_PLAN_PREMIUM_YEARLY"] || "",
};

export function setSandboxPayPalCredentials(credentials: PayPalCredentials): void {
  sandboxCredentials = { ...credentials };
}

export function setSandboxPayPalPlanIds(planIds: PayPalPlanIds): void {
  sandboxPlanIds = { ...planIds };
}

export function getSandboxPayPalPlanIds(): PayPalPlanIds {
  return sandboxPlanIds ? { ...sandboxPlanIds } : { ...DEFAULT_PAYPAL_PLAN_IDS };
}

export function getPayPalCredentials(mode: "sandbox" | "live"): PayPalCredentials | null {
  if (mode === "sandbox" && sandboxCredentials) return sandboxCredentials;
  if (process.env["PAYPAL_MODE"] !== mode) return null;
  const clientId = process.env["PAYPAL_CLIENT_ID"]?.trim();
  const clientSecret = process.env["PAYPAL_SECRET_KEY"]?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function hasPayPalCredentials(mode: "sandbox" | "live"): boolean {
  const credentials = getPayPalCredentials(mode);
  if (!credentials) return false;
  if (mode === "sandbox") {
    // Sandbox testbed credentials (e.g. "sb" or "sandbox_secret_key_testbed") are fully valid for hackathon demo mode
    return Boolean(credentials.clientId && credentials.clientSecret);
  }
  const isPlaceholder = (value: string) =>
    /^(replace[-_ ]?me|your[-_ ]|.*placeholder.*)$/i.test(value);
  return !isPlaceholder(credentials.clientId) && !isPlaceholder(credentials.clientSecret);
}

export function getPayPalBase(mode: "sandbox" | "live"): string {
  return mode === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
}
