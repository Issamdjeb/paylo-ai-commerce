import { logger } from "./logger.js";
import type { CrawledSiteKnowledge } from "./site-crawler.js";
import { getPayPalCredentials } from "./paypal-runtime.js";

export interface PayPalBalanceResult {
  available: string;
  pending: string;
  currency: string;
  currencies: Record<string, string>;
  accountStatus: string;
  bankLast4?: string;
  bankName?: string;
  accountType?: string;
  lastUpdated: string;
  isLive: boolean;
}

/**
 * Queries the real live PayPal API for merchant balances using OAuth credentials.
 * Returns an explicitly unavailable result if PayPal credentials or reporting access are missing.
 */
export async function fetchLivePayPalBalance(
  site?: CrawledSiteKnowledge
): Promise<PayPalBalanceResult> {
  const configuredSandbox = getPayPalCredentials("sandbox");
  const useSandboxRuntime = Boolean(configuredSandbox && !site?.paypalSecretKey);
  const clientId = useSandboxRuntime
    ? configuredSandbox!.clientId
    : site?.paypalClientId || process.env["PAYPAL_CLIENT_ID"] || "";
  const clientSecret = useSandboxRuntime
    ? configuredSandbox!.clientSecret
    : site?.paypalSecretKey || process.env["PAYPAL_SECRET_KEY"] || "";
  const mode = useSandboxRuntime ? "sandbox" : site?.paypalMode || process.env["PAYPAL_MODE"] || "live";
  const currency = site?.currency || "USD";

  const unavailableBalance: PayPalBalanceResult = {
    available: "Unavailable",
    pending: "Unavailable",
    currency,
    currencies: {},
    accountStatus: clientId && clientSecret ? "Balance unavailable" : "PayPal not connected",
    lastUpdated: new Date().toLocaleTimeString(),
    isLive: false,
  };

  if (!clientId || !clientSecret) {
    return unavailableBalance;
  }

  const apiBase =
    mode === "sandbox"
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com";

  try {
    const auth = Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString("base64");
    const tokenRes = await fetch(`${apiBase}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(6000),
    });

    if (!tokenRes.ok) {
      logger.warn({ status: tokenRes.status, mode }, "[paypal-balance] OAuth token call failed");
      return unavailableBalance;
    }

    const tokenData = (await tokenRes.json()) as any;
    const accessToken = tokenData.access_token;
    if (!accessToken) return unavailableBalance;

    // Try PayPal Reporting Balances API
    try {
      const balRes = await fetch(`${apiBase}/v1/reporting/balances?currency_code=ALL`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(6000),
      });

      if (balRes.ok) {
        const balData = (await balRes.json()) as any;
        const balancesList: any[] = balData.balances || [];

        const usdBal = balancesList.find((b) => b.currency === "USD" || b.currency === currency);
        const avail = usdBal?.available_balance?.value || "0.00";
        const pend = usdBal?.withheld_balance?.value || "0.00";

        const currencyMap: Record<string, string> = {};
        for (const b of balancesList) {
          const val = b.available_balance?.value || "0.00";
          const sym = b.currency === "EUR" ? "€" : b.currency === "GBP" ? "£" : "$";
          currencyMap[b.currency] = `${sym}${parseFloat(val).toFixed(2)}`;
        }

        if (Object.keys(currencyMap).length === 0) {
          currencyMap[currency] = "Unavailable";
        }

        return {
          available: parseFloat(avail).toFixed(2),
          pending: parseFloat(pend).toFixed(2),
          currency,
          currencies: currencyMap,
          accountStatus: `PayPal ${mode.toUpperCase()} balance retrieved`,
          lastUpdated: new Date().toLocaleTimeString(),
          isLive: true,
        };
      }
    } catch (err: any) {
      logger.info({ err: err?.message }, "[paypal-balance] Balances reporting endpoint unavailable");
    }

    return unavailableBalance;
  } catch (err: any) {
    logger.warn({ err: err?.message }, "[paypal-balance] Could not fetch live balance from PayPal");
    return unavailableBalance;
  }
}

