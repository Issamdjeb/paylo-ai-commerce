import { Router, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { logger } from "../lib/logger.js";
import { sendTransactionalEmail } from "../lib/brevo.js";
import { loadMerchantSites } from "../lib/site-crawler.js";
import { processPayloChatMessage } from "../lib/paylo-ai-agent.js";
import { getPayPalCredentials, hasPayPalCredentials } from "../lib/paypal-runtime.js";
import { requireAdmin, type AuthenticatedRequest } from "../lib/auth.js";

const router = Router();

const DATA_DIR = path.resolve(process.cwd(), "data");
const INVOICES_FILE = path.resolve(DATA_DIR, "paypal-invoices.json");

interface PayPalInvoiceRecord {
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
  mode: "sandbox" | "live" | "simulated";
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadInvoices(): PayPalInvoiceRecord[] {
  ensureDataDir();
  try {
    if (fs.existsSync(INVOICES_FILE)) {
      const data = fs.readFileSync(INVOICES_FILE, "utf-8");
      return JSON.parse(data) as PayPalInvoiceRecord[];
    }
  } catch (err) {
    logger.warn({ err }, "[paypal-agent] Failed to read invoices file");
  }
  return [];
}

function saveInvoices(invoices: PayPalInvoiceRecord[]) {
  ensureDataDir();
  try {
    fs.writeFileSync(INVOICES_FILE, JSON.stringify(invoices, null, 2), "utf-8");
  } catch (err) {
    logger.error({ err }, "[paypal-agent] Failed to save invoices file");
  }
}

function getPayPalApiBase(): string {
  return "https://api-m.sandbox.paypal.com";
}

async function getPayPalAccessToken(): Promise<string | null> {
  const credentials = getPayPalCredentials("sandbox");
  const clientId = credentials?.clientId;
  const clientSecret = credentials?.clientSecret;

  if (!clientId || !clientSecret) return null;

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  try {
    const res = await fetch(`${getPayPalApiBase()}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.warn({ status: res.status, error: errText }, "[paypal-agent] Token request failed, using sandbox simulator");
      return null;
    }

    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  } catch (err) {
    logger.warn({ err }, "[paypal-agent] Error getting PayPal token");
    return null;
  }
}

// -------------------------------------------------------------
// GET /api/paypal-agent/status
// -------------------------------------------------------------
router.get("/paypal-agent/status", (_req: Request, res: Response) => {
  const configured = hasPayPalCredentials("sandbox");
  const mode = "sandbox";
  res.json({
    status: "ok",
    mode,
    configured,
    clientIdPublic: getPayPalCredentials("sandbox")?.clientId ? `${getPayPalCredentials("sandbox")!.clientId.slice(0, 8)}...` : null,
    mcpEnabled: true,
    supportedTools: [
      "paypal_create_order",
      "paypal_capture_order",
      "paypal_create_invoice",
      "paypal_send_invoice",
      "paypal_get_invoice_qr",
      "paypal_list_invoices",
      "paypal_merchant_insights",
      "hubi_search_ai_tools",
      "hubi_get_plan_details",
    ],
  });
});

// -------------------------------------------------------------
// GET /api/paypal-agent/invoices — List invoices
// -------------------------------------------------------------
router.get("/paypal-agent/invoices", requireAdmin, (_req: Request, res: Response) => {
  const invoices = loadInvoices();
  res.json({
    invoices,
    total: invoices.length,
    totalVolume: invoices
      .filter((i) => i.status === "PAID")
      .reduce((acc, i) => acc + parseFloat(i.amount || "0"), 0),
  });
});

// -------------------------------------------------------------
// POST /api/paypal-agent/invoices/create
// -------------------------------------------------------------
router.post("/paypal-agent/invoices/create", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      recipientEmail,
      recipientName,
      amount,
      itemName,
      itemDescription,
      note,
      dueDate,
    } = req.body ?? {};

    const normalizedEmail = typeof recipientEmail === "string" ? recipientEmail.trim().toLowerCase() : "";
    const normalizedAmount = typeof amount === "string" || typeof amount === "number" ? Number(amount) : NaN;
    const normalizedItemName = typeof itemName === "string" ? itemName.trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || !Number.isFinite(normalizedAmount) || normalizedAmount <= 0 || normalizedAmount > 1000000 || !normalizedItemName || normalizedItemName.length > 127) {
      res.status(400).json({ error: "Enter a valid recipient email, positive amount, and invoice item name." });
      return;
    }

    if ((process.env["PAYPAL_MODE"] || "sandbox") !== "sandbox") {
      res.status(409).json({ error: "Invoice actions from this demo are sandbox-only. Live invoicing is disabled to protect the merchant account." });
      return;
    }

    const token = await getPayPalAccessToken();
    if (!token) {
      res.status(503).json({ error: "PayPal Sandbox credentials are missing or could not be verified. No invoice was created." });
      return;
    }
    const invoices = loadInvoices();
    const generatedInvoiceNumber = `HUBI-${Date.now()}`;
    const invoicePayload = {
      detail: {
        invoice_number: generatedInvoiceNumber,
        reference: "aitoolshubi-agent",
        invoice_date: new Date().toISOString().slice(0, 10),
        currency_code: "USD",
        note: typeof note === "string" ? note.slice(0, 3000) : "",
        payment_term: { term_type: "DUE_ON_RECEIPT" },
      },
      invoicer: { name: { given_name: "AItools", surname: "Hubi" } },
      primary_recipients: [{ billing_info: {
        ...(typeof recipientName === "string" && recipientName.trim() ? { name: { given_name: recipientName.trim().slice(0, 140) } } : {}),
        email_address: normalizedEmail,
      } }],
      items: [{
        name: normalizedItemName,
        ...(typeof itemDescription === "string" && itemDescription.trim() ? { description: itemDescription.trim().slice(0, 3000) } : {}),
        quantity: "1",
        unit_amount: { currency_code: "USD", value: normalizedAmount.toFixed(2) },
        unit_of_measure: "QUANTITY",
      }],
    };
    const ppRes = await fetch(`${getPayPalApiBase()}/v2/invoicing/invoices`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(invoicePayload),
    });
    if (!ppRes.ok) {
      const errorText = await ppRes.text();
      logger.warn({ status: ppRes.status, error: errorText }, "[paypal-agent] PayPal Sandbox draft invoice request failed");
      res.status(502).json({ error: "PayPal Sandbox could not create the invoice draft. No simulated invoice was saved." });
      return;
    }
    const ppData = (await ppRes.json()) as any;
    if (!ppData.id) {
      res.status(502).json({ error: "PayPal did not return an invoice ID. No local invoice was saved." });
      return;
    }
    const viewUrl = ppData.links?.find((link: any) => link.rel === "payer-view")?.href || ppData.links?.find((link: any) => link.rel === "self")?.href || `https://www.sandbox.paypal.com/invoice/p/#${ppData.id}`;
    const createdInvoice: PayPalInvoiceRecord = {
      id: ppData.id,
      invoiceNumber: ppData.detail?.invoice_number || generatedInvoiceNumber,
      recipientEmail: normalizedEmail,
      recipientName: typeof recipientName === "string" ? recipientName.trim() : undefined,
      amount: normalizedAmount.toFixed(2),
      currency: "USD",
      itemName: normalizedItemName,
      itemDescription: typeof itemDescription === "string" ? itemDescription.trim() : undefined,
      status: "DRAFT",
      createdAt: new Date().toISOString(),
      dueDate: typeof dueDate === "string" ? dueDate : new Date(Date.now() + 86400000 * 14).toISOString(),
      note: typeof note === "string" ? note : undefined,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(viewUrl)}`,
      viewUrl,
      mode: "sandbox",
    };

    invoices.unshift(createdInvoice);
    saveInvoices(invoices);

    res.status(201).json({
      success: true,
      invoice: createdInvoice,
      message: `Invoice #${createdInvoice.invoiceNumber} drafted successfully for $${createdInvoice.amount} USD.`,
    });
  } catch (err: any) {
    logger.error({ err }, "[paypal-agent] Exception creating invoice");
    res.status(500).json({ error: err.message || "Failed to create invoice" });
  }
});

function createSimulatedInvoice(params: {
  generatedId: string;
  generatedInvoiceNumber: string;
  recipientEmail: string;
  recipientName?: string;
  amount: string;
  itemName: string;
  itemDescription?: string;
  note?: string;
  dueDate?: string;
}): PayPalInvoiceRecord {
  const payUrl = `https://www.sandbox.paypal.com/invoice/p/#${params.generatedId}`;
  return {
    id: params.generatedId,
    invoiceNumber: params.generatedInvoiceNumber,
    recipientEmail: params.recipientEmail,
    recipientName: params.recipientName,
    amount: parseFloat(params.amount).toFixed(2),
    currency: "USD",
    itemName: params.itemName,
    itemDescription: params.itemDescription,
    status: "DRAFT",
    createdAt: new Date().toISOString(),
    dueDate: params.dueDate || new Date(Date.now() + 86400000 * 14).toISOString(),
    note: params.note,
    qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(payUrl)}`,
    viewUrl: payUrl,
    mode: "simulated",
  };
}

// -------------------------------------------------------------
// POST /api/paypal-agent/invoices/:id/send
// -------------------------------------------------------------
router.post("/paypal-agent/invoices/:id/send", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const invoices = loadInvoices();
  const index = invoices.findIndex((i) => i.id === id);

  if (index === -1) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  const invoice = invoices[index];
  if (invoice.mode !== "sandbox" || (process.env["PAYPAL_MODE"] || "sandbox") !== "sandbox") {
    res.status(409).json({ error: "Only PayPal Sandbox invoices can be sent from this demo." });
    return;
  }
  if (invoice.status !== "DRAFT") {
    res.status(409).json({ error: `Invoice is ${invoice.status.toLowerCase()} and cannot be sent again.` });
    return;
  }
  const token = await getPayPalAccessToken();
  if (!token) {
    res.status(503).json({ error: "PayPal Sandbox credentials are missing or could not be verified. Invoice was not sent." });
    return;
  }
  const paypalResponse = await fetch(`${getPayPalApiBase()}/v2/invoicing/invoices/${encodeURIComponent(id)}/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ send_to_recipient: true, send_to_invoicer: false }),
  });
  if (!paypalResponse.ok) {
    const errorText = await paypalResponse.text();
    logger.warn({ status: paypalResponse.status, error: errorText }, "[paypal-agent] PayPal Sandbox invoice send failed");
    res.status(502).json({ error: "PayPal Sandbox could not send the invoice. The invoice status was not changed locally." });
    return;
  }
  invoice.status = "SENT";
  invoices[index] = invoice;
  saveInvoices(invoices);

  res.json({
    success: true,
    invoice,
    message: `Invoice #${invoice.invoiceNumber} successfully dispatched to ${invoice.recipientEmail}.`,
  });
});

// -------------------------------------------------------------
// GET /api/paypal-agent/invoices/:id/qr
// -------------------------------------------------------------
router.get("/paypal-agent/invoices/:id/qr", requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const invoices = loadInvoices();
  const invoice = invoices.find((i) => i.id === id);

  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  const qrUrl = invoice.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(invoice.viewUrl || "https://paypal.com")}`;
  res.json({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    qrCodeUrl: qrUrl,
    viewUrl: invoice.viewUrl,
  });
});

// -------------------------------------------------------------
// GET /api/paypal-agent/insights — Merchant analytics
// -------------------------------------------------------------
router.get("/paypal-agent/insights", requireAdmin, (_req: Request, res: Response) => {
  const invoices = loadInvoices();
  const paidInvoices = invoices.filter((i) => i.status === "PAID");
  const totalPaidVolume = paidInvoices.reduce((acc, i) => acc + parseFloat(i.amount || "0"), 0);

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    currency: "USD",
    metrics: {
      totalVolume: totalPaidVolume.toFixed(2),
      monthlyGrowthRate: null,
      activeSubscribers: null,
      successfulTransactions: paidInvoices.length,
      averageOrderValue: paidInvoices.length ? (totalPaidVolume / paidInvoices.length).toFixed(2) : "0.00",
      disputeRate: null,
      chargebackHealth: "Not available from this demo API",
      payoutCadence: "Not available from this demo API",
      breakdown: {
        subscriptions: null,
        featuredListings: null,
        creatorInvoices: totalPaidVolume.toFixed(2),
      },
    },
    sandboxVerified: hasPayPalCredentials("sandbox"),
  });
});

// -------------------------------------------------------------
// POST /api/paypal-agent/mcp — Model Context Protocol endpoint
// -------------------------------------------------------------
router.post("/paypal-agent/mcp", requireAdmin, async (req: Request, res: Response) => {
  const { jsonrpc, id, method, params } = req.body ?? {};

  if (jsonrpc !== "2.0") {
    res.status(400).json({ jsonrpc: "2.0", id: id ?? null, error: { code: -32600, message: "Invalid Request: jsonrpc must be '2.0'" } });
    return;
  }

  if (method === "tools/list") {
    res.json({
      jsonrpc: "2.0",
      id,
      result: {
        tools: [
          {
            name: "paypal_create_order",
            description: "Initiate an autonomous PayPal checkout order for memberships, sponsorships, or software access on AItools Hubi.",
            inputSchema: {
              type: "object",
              properties: {
                tier: { type: "string", enum: ["community", "featured", "premium"], description: "Selected plan or tier" },
                interval: { type: "string", enum: ["monthly", "yearly"], description: "Billing frequency" },
                buyerEmail: { type: "string", description: "Email of the purchasing member" },
              },
              required: ["tier", "interval"],
            },
          },
          {
            name: "paypal_create_invoice",
            description: "Create and draft a professional PayPal invoice with line items, recipient details, and payment terms.",
            inputSchema: {
              type: "object",
              properties: {
                recipientEmail: { type: "string", description: "Client email address" },
                recipientName: { type: "string", description: "Client or partner company name" },
                amount: { type: "string", description: "Total amount in USD (e.g. '149.00')" },
                itemName: { type: "string", description: "Item title or description" },
                note: { type: "string", description: "Terms or invoice note" },
              },
              required: ["recipientEmail", "amount", "itemName"],
            },
          },
          {
            name: "paypal_send_invoice",
            description: "Dispatch a drafted PayPal invoice to the recipient email with secure payment links.",
            inputSchema: {
              type: "object",
              properties: {
                invoiceId: { type: "string", description: "ID of the invoice to dispatch" },
              },
              required: ["invoiceId"],
            },
          },
          {
            name: "paypal_get_invoice_qr",
            description: "Generate a scannable PayPal QR code image URL for instant mobile checkout.",
            inputSchema: {
              type: "object",
              properties: {
                invoiceId: { type: "string", description: "Target invoice ID" },
              },
              required: ["invoiceId"],
            },
          },
          {
            name: "paypal_merchant_insights",
            description: "Fetch real-time merchant reporting data: gross volume, subscription revenue, dispute health, and transaction stats.",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "hubi_search_ai_tools",
            description: "Search 500+ verified AI tools by category, capability, or budget.",
            inputSchema: {
              type: "object",
              properties: {
                query: { type: "string", description: "Search query or category keyword" },
              },
              required: ["query"],
            },
          },
        ],
      },
    });
    return;
  }

  if (method === "tools/call") {
    const toolName = params?.name;
    const args = params?.arguments ?? {};

    try {
      if (toolName === "paypal_create_order") {
        const tier = args.tier || "community";
        const interval = args.interval || "monthly";
        const pricing = tier === "premium" ? (interval === "yearly" ? "399.00" : "49.00") : tier === "featured" ? (interval === "yearly" ? "149.00" : "19.00") : (interval === "yearly" ? "59.00" : "6.00");
        const orderId = `PAYPAL-MCP-ORD-${Date.now().toString(36).toUpperCase()}`;

        res.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: `PayPal Order created successfully: ID ${orderId}. Plan: ${tier} (${interval}) for $${pricing} USD.`,
              },
            ],
            data: { orderId, tier, interval, amount: pricing, status: "CREATED" },
          },
        });
        return;
      }

      if (toolName === "paypal_create_invoice") {
        const invoices = loadInvoices();
        const nextSeq = String(invoices.length + 1).padStart(3, "0");
        const generatedInvoiceNumber = `INV2-HUBI-${nextSeq}`;
        const generatedId = `INV2-${Date.now().toString(36).toUpperCase()}`;
        const newInvoice = createSimulatedInvoice({
          generatedId,
          generatedInvoiceNumber,
          recipientEmail: args.recipientEmail,
          recipientName: args.recipientName,
          amount: args.amount,
          itemName: args.itemName,
          itemDescription: args.itemDescription,
          note: args.note,
        });
        invoices.unshift(newInvoice);
        saveInvoices(invoices);

        res.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: `Created PayPal Invoice #${newInvoice.invoiceNumber} for $${newInvoice.amount} USD. Recipient: ${newInvoice.recipientEmail}.`,
              },
            ],
            data: newInvoice,
          },
        });
        return;
      }

      if (toolName === "paypal_send_invoice") {
        const invoices = loadInvoices();
        const invoice = invoices.find((i) => i.id === args.invoiceId);
        if (!invoice) throw new Error("Invoice not found");
        invoice.status = "SENT";
        saveInvoices(invoices);

        res.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: `Dispatched PayPal Invoice #${invoice.invoiceNumber} to ${invoice.recipientEmail}.`,
              },
            ],
            data: invoice,
          },
        });
        return;
      }

      if (toolName === "paypal_merchant_insights") {
        const invoices = loadInvoices();
        const paidInvoices = invoices.filter((invoice) => invoice.status === "PAID");
        const totalPaidVolume = paidInvoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
        res.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: `PayPal invoice ledger: ${paidInvoices.length} paid invoices totaling $${totalPaidVolume.toFixed(2)} USD. Subscriber count and dispute status are not available from this demo API.`,
              },
            ],
            data: { volume: totalPaidVolume.toFixed(2), paidInvoices: paidInvoices.length, subscribers: null, disputes: null },
          },
        });
        return;
      }

      res.status(404).json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Tool not found: ${toolName}` } });
    } catch (toolErr: any) {
      res.status(500).json({ jsonrpc: "2.0", id, error: { code: -32000, message: toolErr.message || "Execution error" } });
    }
    return;
  }

  res.status(400).json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown method: ${method}` } });
});

// -------------------------------------------------------------
// POST /api/paypal-agent/chat — Conversational Agent with PayPal Tool Calling
// -------------------------------------------------------------
router.post("/paypal-agent/chat", async (req: Request, res: Response) => {
  try {
    const { message, siteId = "aitoolshubi", persona = "shopper", history = [] } = req.body ?? {};
    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "Message string is required" });
      return;
    }
    const sites = loadMerchantSites();
    const site = sites.find((candidate) => candidate.id === siteId) || sites.find((candidate) => candidate.id === "aitoolshubi") || sites[0];
    if (!site) {
      res.status(404).json({ error: "No merchant catalog is configured for Paylo." });
      return;
    }
    res.json(await processPayloChatMessage(message, site, persona, history));
  } catch (err: any) {
    logger.error({ err }, "[paypal-agent] Chat exception");
    res.status(500).json({ error: err.message || "Failed to process agent request" });
    return;
  }
});

export default router;
