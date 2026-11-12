import { logger } from "./logger";

const BREVO_BASE = "https://api.brevo.com/v3";

export type BrevoResult = { ok: true } | { ok: false; error: string };

function getKey(): string | null {
  return process.env["BREVO_API_KEY"] ?? null;
}

export function isBrevoConfigured(): boolean {
  return Boolean(getKey() && process.env["BREVO_SENDER_EMAIL"]);
}

/** Only standard Brevo attributes — custom ones must exist in the Brevo dashboard or contact creation fails. */
function safeContactAttributes(attributes: ContactAttributes): ContactAttributes {
  const safe: ContactAttributes = {};
  if (attributes.FIRSTNAME) safe.FIRSTNAME = attributes.FIRSTNAME;
  if (attributes.LASTNAME) safe.LASTNAME = attributes.LASTNAME;
  return safe;
}

function listId(envVar: string, fallback: number): number {
  return parseInt(process.env[envVar] ?? String(fallback), 10);
}

export const LIST_NEWSLETTER = () => listId("BREVO_LIST_NEWSLETTER", 2);
export const LIST_PARTNERS   = () => listId("BREVO_LIST_PARTNERS",   3);
export const LIST_COMMUNITY  = () => listId("BREVO_LIST_COMMUNITY",  4);

interface ContactAttributes {
  FIRSTNAME?: string;
  LASTNAME?: string;
  COMPANY?: string;
  WEBSITE?: string;
  SOURCE?: string;
  [k: string]: string | undefined;
}

export async function addContactToList(
  email: string,
  listId: number,
  attributes: ContactAttributes = {},
): Promise<BrevoResult> {
  const key = getKey();
  if (!key) {
    const error = "BREVO_API_KEY is not configured";
    logger.warn(`[brevo] ${error}`);
    return { ok: false, error };
  }

  const body = {
    email,
    attributes: safeContactAttributes(attributes),
    listIds: [listId],
    updateEnabled: true,
  };

  try {
    const res = await fetch(`${BREVO_BASE}/contacts`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": key,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.error({ status: res.status, text }, "[brevo] addContact failed");
      return { ok: false, error: `Brevo contact sync failed (${res.status}): ${text}` };
    }
    logger.info({ listId, email }, "[brevo] contact added");
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "[brevo] addContact error");
    return { ok: false, error: String(err) };
  }
}

interface TransactionalEmail {
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  tags?: string[];
  replyTo?: { email: string; name?: string };
  /** Personal sender name helps Gmail classify as Primary instead of Promotions. */
  senderName?: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function sendTransactionalEmail(opts: TransactionalEmail): Promise<BrevoResult> {
  // Hard killswitch — set DISABLE_TRANSACTIONAL_EMAILS=true in env to stop ALL outbound emails instantly
  if (process.env["DISABLE_TRANSACTIONAL_EMAILS"] === "true") {
    logger.warn("[brevo] sendEmail BLOCKED — DISABLE_TRANSACTIONAL_EMAILS=true");
    return { ok: false, error: "emails disabled by env killswitch" };
  }

  const key = getKey();
  const senderEmail = process.env["BREVO_SENDER_EMAIL"];
  if (!key || !senderEmail) {
    const error = "BREVO_API_KEY or BREVO_SENDER_EMAIL is not configured";
    logger.warn(`[brevo] sendEmail skipped — ${error}`);
    return { ok: false, error };
  }

  const textContent = opts.textContent || stripHtml(opts.htmlContent);
  const senderName = opts.senderName || process.env["BREVO_SENDER_NAME"] || "Aitools Hubi";
  const replyTo = opts.replyTo ?? { email: senderEmail, name: senderName };

  // Brevo v3 requires non-empty string for name if provided
  const sanitizedTo = (opts.to || []).map((recipient) => {
    const rawName = (recipient.name || "").trim();
    const fallbackName = recipient.email.split("@")[0] || "AI Builder";
    return {
      email: recipient.email.trim(),
      name: rawName || fallbackName,
    };
  });

  const body: Record<string, unknown> = {
    sender: { name: senderName, email: senderEmail },
    to: sanitizedTo,
    replyTo,
    subject: opts.subject,
    htmlContent: opts.htmlContent,
    textContent,
  };
  if (opts.tags && opts.tags.length > 0) body.tags = opts.tags;

  try {
    const res = await fetch(`${BREVO_BASE}/smtp/email`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": key,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.error({ status: res.status, text }, "[brevo] sendEmail failed");
      return { ok: false, error: `Brevo email failed (${res.status}): ${text}` };
    }
    logger.info({ to: opts.to.map((t) => t.email) }, "[brevo] email sent");
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "[brevo] sendEmail error");
    return { ok: false, error: String(err) };
  }
}

export interface BatchEmailResult {
  sent: number;
  failed: number;
  errors: string[];
  deliveredTo: string[];
  failedRecipients: Array<{ email: string; reason: string }>;
}

/** Send emails in small batches to avoid rate limits; returns detailed per-recipient results. */
export async function sendTransactionalEmailBatch(
  recipients: { email: string; name?: string }[],
  buildEmail: (recipient: { email: string; name?: string }) => Omit<TransactionalEmail, "to">,
  batchSize = 5,
): Promise<BatchEmailResult> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  const deliveredTo: string[] = [];
  const failedRecipients: Array<{ email: string; reason: string }> = [];

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (recipient) => {
        const cleanEmail = (recipient.email || "").trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
          return { ok: false, error: "Invalid email syntax or empty address", email: cleanEmail };
        }
        const { subject, htmlContent, tags } = buildEmail({ ...recipient, email: cleanEmail });
        const res = await sendTransactionalEmail({
          to: [{ ...recipient, email: cleanEmail }],
          subject,
          htmlContent,
          tags,
        });
        return { ...res, email: cleanEmail };
      }),
    );

    for (const result of results) {
      if (result.ok) {
        sent++;
        deliveredTo.push(result.email);
      } else {
        failed++;
        const reason = result.error || "Email delivery rejected or unverified in Brevo";
        failedRecipients.push({ email: result.email, reason });
        if (errors.length < 5) errors.push(`${result.email}: ${reason}`);
      }
    }
  }

  return { sent, failed, errors, deliveredTo, failedRecipients };
}

export interface CosmicEmailOptions {
  preheader?: string;
  badgeText: string;
  badgeColor?: "cyan" | "emerald" | "amber" | "purple" | "rose";
  title: string;
  subtitle?: string;
  bodyContent?: string;
  highlightPillars?: Array<{
    tag?: string;
    title: string;
    description: string;
  }>;
  featuredImageUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
  secondaryNote?: string;
  showFounderSignoff?: boolean;
}

export function renderAitoolsCosmicEmail(opts: CosmicEmailOptions): string {
  const badgeStyles = {
    cyan: {
      bg: "rgba(56, 189, 248, 0.12)",
      border: "rgba(56, 189, 248, 0.35)",
      text: "#38bdf8",
      dot: "#38bdf8",
    },
    emerald: {
      bg: "rgba(16, 185, 129, 0.12)",
      border: "rgba(16, 185, 129, 0.35)",
      text: "#34d399",
      dot: "#10b981",
    },
    amber: {
      bg: "rgba(245, 158, 11, 0.12)",
      border: "rgba(245, 158, 11, 0.35)",
      text: "#fbbf24",
      dot: "#f59e0b",
    },
    purple: {
      bg: "rgba(168, 85, 247, 0.12)",
      border: "rgba(168, 85, 247, 0.35)",
      text: "#c084fc",
      dot: "#a855f7",
    },
    rose: {
      bg: "rgba(244, 63, 94, 0.12)",
      border: "rgba(244, 63, 94, 0.35)",
      text: "#fb7185",
      dot: "#f43f5e",
    },
  }[opts.badgeColor || "cyan"];

  const preheaderText = opts.preheader || opts.title;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(opts.title)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style type="text/css">
    /* Reset */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; min-width: 100% !important; }

    /* Mobile Responsive */
    @media only screen and (max-width: 480px) {
      .email-container { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; }
      .email-body-pad { padding-left: 16px !important; padding-right: 16px !important; }
      .email-body-pad-top { padding: 16px 16px 12px !important; }
      .email-hero-img { height: 120px !important; }
      .email-title { font-size: 20px !important; }
      .email-subtitle { font-size: 13px !important; }
      .brand-row { display: block !important; width: 100% !important; }
      .brand-logo-cell { display: block !important; width: 100% !important; padding-bottom: 10px !important; }
      .brand-badge-cell { display: block !important; width: 100% !important; text-align: left !important; }
      .pillar-pad { padding: 12px 14px !important; }
      .pillar-title { font-size: 12px !important; }
      .pillar-desc { font-size: 11px !important; }
      .cta-btn { display: block !important; width: 100% !important; padding: 14px 20px !important; text-align: center !important; box-sizing: border-box !important; }
      .cta-table { width: 100% !important; }
      .footer-pad { padding: 16px !important; }
      .footer-text { font-size: 10px !important; }
      .otp-code { font-size: 28px !important; letter-spacing: 8px !important; padding: 14px 20px !important; }
      .receipt-label { font-size: 11px !important; }
      .receipt-value { font-size: 11px !important; }
      .signoff-text { font-size: 10px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:24px 8px;background-color:#030712;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#f8fafc;">
  <!-- Preheader preview snippet -->
  <div style="display:none;font-size:1px;color:#030712;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${escapeHtml(preheaderText)}
  </div>

  <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" class="email-container" style="max-width:580px;margin:0 auto;background:#090d16;border-radius:20px;border:1px solid #1e293b;overflow:hidden;box-shadow:0 24px 50px rgba(0,0,0,0.7);">
    <!-- Cosmic Earth Hero Image Banner -->
    <tr>
      <td style="padding:0;background:#030712;line-height:0;">
        <img src="https://aitoolshubi.com/earth-at-night.jpg" alt="AItools Hubi Orbital Global View" width="580" class="email-hero-img" style="width:100%;max-width:580px;height:160px;object-fit:cover;display:block;border-bottom:1px solid rgba(56,189,248,0.25);" />
      </td>
    </tr>

    <!-- Brand Header & Status Pill Row -->
    <tr>
      <td class="email-body-pad-top" style="padding:22px 28px 16px;">
        <table width="100%" border="0" cellpadding="0" cellspacing="0">
          <tr class="brand-row">
            <td align="left" class="brand-logo-cell" style="vertical-align:middle;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:34px;height:34px;background:linear-gradient(135deg, #0284c7 0%, #2563eb 100%);border-radius:9px;text-align:center;color:#ffffff;font-weight:900;font-size:16px;line-height:34px;box-shadow:0 2px 10px rgba(2,132,199,0.4);">
                    H
                  </td>
                  <td style="padding-left:12px;vertical-align:middle;">
                    <div style="font-size:15px;font-weight:800;letter-spacing:-0.3px;color:#ffffff;line-height:1.2;">AItools Hubi</div>
                    <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:#38bdf8;text-transform:uppercase;margin-top:2px;">GLOBAL AI DIRECTORY</div>
                  </td>
                </tr>
              </table>
            </td>
            <td align="right" class="brand-badge-cell" style="vertical-align:middle;">
              <span style="display:inline-block;padding:5px 12px;background:${badgeStyles.bg};border:1px solid ${badgeStyles.border};border-radius:999px;color:${badgeStyles.text};font-size:10px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;white-space:nowrap;">
                ● ${escapeHtml(opts.badgeText)}
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Glowing Divider -->
    <tr>
      <td class="email-body-pad" style="padding:0 28px;">
        <div style="height:1px;background:linear-gradient(90deg, rgba(56,189,248,0.4) 0%, rgba(30,41,59,0.3) 100%);"></div>
      </td>
    </tr>

    <!-- Main Content Area -->
    <tr>
      <td class="email-body-pad" style="padding:24px 28px 28px;">
        <h1 class="email-title" style="font-size:23px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;margin:0 0 12px;line-height:1.3;word-wrap:break-word;overflow-wrap:break-word;">
          ${escapeHtml(opts.title)}
        </h1>

        ${opts.subtitle ? `<p class="email-subtitle" style="font-size:14px;line-height:1.65;color:#94a3b8;margin:0 0 20px;word-wrap:break-word;overflow-wrap:break-word;">${opts.subtitle}</p>` : ""}

        <!-- Featured Preview Image (If present) -->
        ${
          opts.featuredImageUrl
            ? `<div style="margin:20px 0 24px;border-radius:14px;overflow:hidden;border:1px solid #334155;background:#050811;box-shadow:0 12px 28px rgba(0,0,0,0.55);text-align:center;">
                <img src="${escapeHtml(opts.featuredImageUrl)}" alt="Preview" style="width:100%;max-width:524px;height:auto;display:block;margin:0 auto;border-radius:13px;" />
              </div>`
            : ""
        }

        <!-- Scannable Cognitive Micro-Pillars -->
        ${
          opts.highlightPillars && opts.highlightPillars.length > 0
            ? `<div style="margin:20px 0 24px;">
                ${opts.highlightPillars
                  .map(
                    (p) => `
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:10px;background:#0f172a;border:1px solid #1e293b;border-radius:12px;overflow:hidden;">
                    <tr>
                      <td class="pillar-pad" style="padding:14px 16px;">
                        ${p.tag ? `<span style="display:inline-block;padding:2px 8px;border-radius:6px;background:rgba(56,189,248,0.12);color:#38bdf8;font-size:10px;font-weight:700;letter-spacing:0.5px;margin-bottom:6px;text-transform:uppercase;">${escapeHtml(p.tag)}</span>` : ""}
                        <div class="pillar-title" style="font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:4px;line-height:1.3;word-wrap:break-word;overflow-wrap:break-word;">${escapeHtml(p.title)}</div>
                        <div class="pillar-desc" style="font-size:12px;color:#94a3b8;line-height:1.55;word-wrap:break-word;overflow-wrap:break-word;">${escapeHtml(p.description)}</div>
                      </td>
                    </tr>
                  </table>`
                  )
                  .join("")}
              </div>`
            : ""
        }

        ${opts.bodyContent ? `<div style="margin:16px 0;word-wrap:break-word;overflow-wrap:break-word;">${opts.bodyContent}</div>` : ""}

        <!-- High-Converting CTA Button -->
        ${
          opts.ctaText && opts.ctaUrl
            ? `<table border="0" cellpadding="0" cellspacing="0" class="cta-table" style="margin:26px auto 22px;">
                <tr>
                  <td align="center" style="border-radius:12px;background:linear-gradient(135deg, #0284c7 0%, #2563eb 100%);box-shadow:0 6px 20px rgba(2,132,199,0.4);">
                    <a href="${escapeHtml(opts.ctaUrl)}" target="_blank" class="cta-btn" style="display:inline-block;padding:14px 34px;font-size:13px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">
                      ${escapeHtml(opts.ctaText)} →
                    </a>
                  </td>
                </tr>
              </table>`
            : ""
        }

        <!-- Reassurance & Founder Sign-off -->
        <div style="margin-top:24px;padding-top:18px;border-top:1px solid #1e293b;">
          ${
            opts.secondaryNote
              ? `<p class="signoff-text" style="font-size:12px;line-height:1.6;color:#64748b;margin:0 0 10px;word-wrap:break-word;overflow-wrap:break-word;">${opts.secondaryNote}</p>`
              : ""
          }
          ${
            opts.showFounderSignoff !== false
              ? `<p class="signoff-text" style="font-size:11px;line-height:1.6;color:#475569;margin:0;word-wrap:break-word;overflow-wrap:break-word;">
                  Sent from <strong>Issam & the AItools Hubi Engineering Team</strong>. Have questions or need priority placement? Simply reply directly to this email.
                </p>`
              : ""
          }
        </div>
      </td>
    </tr>

    <!-- Trust & Social Proof Footer -->
    <tr>
      <td class="footer-pad" style="padding:20px 28px;background:#050811;border-top:1px solid #1e293b;text-align:center;">
        <p class="footer-text" style="font-size:11px;color:#475569;margin:0 0 8px;line-height:1.5;">
          AItools Hubi · The Global Verified Directory of 500+ Frontier AI Tools & Benchmarks
        </p>
        <p class="footer-text" style="font-size:11px;color:#64748b;margin:0;">
          <a href="https://aitoolshubi.com/tools" style="color:#38bdf8;text-decoration:none;font-weight:600;">Browse Tools</a> · 
          <a href="https://aitoolshubi.com/dashboard?mode=partner&tab=listing" style="color:#38bdf8;text-decoration:none;font-weight:600;">Founder Console</a> · 
          <a href="https://aitoolshubi.com/pricing" style="color:#38bdf8;text-decoration:none;font-weight:600;">Partnerships</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildNewsletterWelcomeEmailHtml(name: string): string {
  const firstName = name?.trim() || "there";
  return renderAitoolsCosmicEmail({
    badgeText: "WEEKLY AI INTELLIGENCE",
    badgeColor: "cyan",
    title: "Welcome to AI Tool Drops",
    subtitle: `Hi ${escapeHtml(firstName)}, thanks for subscribing. Every week, our editorial team stress-tests, analyzes, and indexes the top verified AI tools, frontier model updates, and developer stack blueprints.`,
    highlightPillars: [
      {
        tag: "WEEKLY BENCHMARKS",
        title: "Verified AI Tool Drops",
        description: "Zero marketing fluff. Real testing on inference speed, pricing tiers, and developer agent capabilities.",
      },
      {
        tag: "PRODUCTION BLUEPRINTS",
        title: "Fullstack AI Workflows",
        description: "Step-by-step blueprints pairing Cursor, v0, Next.js, and LLM APIs into revenue-generating software.",
      },
      {
        tag: "EXCLUSIVE ACCESS",
        title: "Founder Beta Invites & Perks",
        description: "Direct community discounts, early beta invites, and founder drop alerts delivered straight to your inbox.",
      },
    ],
    ctaText: "Explore 500+ AI Tools Directory",
    ctaUrl: "https://aitoolshubi.com/tools",
  });
}

export function buildCommunityWelcomeEmailText(name: string): string {
  const firstName = name?.trim() || "there";
  return `Hi ${firstName},

Welcome to AItools Hubi Pro Community.

Your membership gives you full access to:
- Unlimited Hubi AI Architect consultations
- Exclusive step-by-step workflow guides and prompt files
- Direct community discussions and creator drops
- Priority access to frontier tool releases

Access your workspace now: https://aitoolshubi.com/dashboard

If you have any questions or need tailored tool recommendations, reply directly to this email.

Best regards,
AItools Hubi Team
https://aitoolshubi.com`;
}

export function buildCommunityWelcomeEmailHtml(name: string): string {
  const firstName = name?.trim() || "there";
  return renderAitoolsCosmicEmail({
    badgeText: "PRO MEMBERSHIP ACTIVE",
    badgeColor: "emerald",
    title: "Your Pro Workspace is Ready",
    subtitle: `Hi ${escapeHtml(firstName)}, welcome to AItools Hubi Pro. Your power developer workspace has been activated with unlimited research capabilities.`,
    highlightPillars: [
      {
        tag: "UNLIMITED CONSULTATIONS",
        title: "Hubi AI Architect",
        description: "Direct real-time consultation for stack recommendations, model trade-offs, and tool workflows.",
      },
      {
        tag: "PRODUCTION BLUEPRINTS",
        title: "Fullstack Masterclass Guides",
        description: "Access complete architectural breakdowns and copy-paste prompts (Cursor, v0, Next.js, and LLM APIs).",
      },
      {
        tag: "FOUNDER & CREATOR FEED",
        title: "Direct Community Signal",
        description: "Engage with verified tool creators, explore trending stack combinations, and unlock verified discounts.",
      },
    ],
    ctaText: "Open Pro Workspace",
    ctaUrl: "https://aitoolshubi.com/dashboard",
    secondaryNote: "Your membership renews monthly and can be managed anytime directly inside Account Settings.",
  });
}

export function buildPartnershipReceivedEmailHtml(data: { companyName: string; toolName: string; tier: string }): string {
  const toolName = data.toolName ? escapeHtml(data.toolName) : null;
  const companyName = escapeHtml(data.companyName || "there");
  const tier = escapeHtml(data.tier.toUpperCase());

  return renderAitoolsCosmicEmail({
    badgeText: "APPLICATION RECEIVED",
    badgeColor: "cyan",
    title: `Review in Progress: ${toolName}`,
    subtitle: `Thank you for submitting ${toolName} (${companyName}) for partnership verification on AItools Hubi under the ${tier} tier.`,
    highlightPillars: [
      {
        tag: "STEP 1 · 24-48H REVIEW",
        title: "Domain & Metadata Verification",
        description: "Our review board checks domain uptime, metadata clarity, and feature accuracy to maintain directory trust.",
      },
      {
        tag: "STEP 2 · PROVISIONAL ACCESS",
        title: "Founder Console Provisioned",
        description: "Your partner console is already initialized. You can update your tagline, docs, and screenshots right now.",
      },
      {
        tag: "STEP 3 · INSTANT NOTIFICATION",
        title: "Live Activation Alert",
        description: "Once verified, your tool goes live to thousands of AI software buyers with real-time outbound telemetry.",
      },
    ],
    ctaText: "Open Founder Console",
    ctaUrl: "https://aitoolshubi.com/dashboard?mode=partner&tab=listing",
    secondaryNote: "Have launch assets or update announcements to accompany your listing? Reply directly to this email.",
  });
}

export function buildPartnershipApprovedEmailHtml(data: { companyName: string; toolName: string; tier: string }): string {
  const toolName = data.toolName ? escapeHtml(data.toolName) : null;
  const tier = escapeHtml(data.tier.toUpperCase());

  return renderAitoolsCosmicEmail({
    badgeText: "LISTING APPROVED & VERIFIED",
    badgeColor: "emerald",
    title: `${toolName} is Now Live Globally`,
    subtitle: `Great news! ${toolName} has been officially approved for verified listing on AItools Hubi under the ${tier} tier.`,
    highlightPillars: [
      {
        tag: "DIRECTORY INDEXING",
        title: "Global Search & Category Placement",
        description: "Your product profile is actively indexed and discoverable across our category directories and comparison engines.",
      },
      {
        tag: "OUTBOUND TELEMETRY",
        title: "Live Impressions & Referral Clicks",
        description: "Monitor real-time visitor traffic, bookmark counts, and outbound clicks in your Founder Dashboard.",
      },
      {
        tag: "VERIFIED BADGE",
        title: "Official Verification Embed",
        description: "Showcase your credibility by embedding the official 'Verified on AItools Hubi' dynamic badge on your landing page.",
      },
    ],
    ctaText: "Open Partner Analytics & Console",
    ctaUrl: "https://aitoolshubi.com/dashboard?mode=partner&tab=listing",
    secondaryNote: "Remember to keep your pricing and feature highlights up to date to maximize click-through conversion.",
  });
}

export function buildPaidListingActivatedEmailHtml(data: { toolName?: string; tier: string }): string {
  const toolName = data.toolName ? escapeHtml(data.toolName) : null;
  const tier = escapeHtml(data.tier.replace(/_/g, " ").toUpperCase());

  return renderAitoolsCosmicEmail({
    badgeText: "PAYMENT CONFIRMED",
    badgeColor: "emerald",
    title: toolName ? `${toolName} launch package is confirmed` : "Your Partner Plan Is Active",
    subtitle: toolName ? `Your payment for the ${tier} launch package is confirmed. Open your Founder Dashboard to review your listing.` : `Your ${tier} partner plan is active. Open your dashboard to manage your partner features.`,
    highlightPillars: [
      {
        tag: "DIRECTORY LISTING",
        title: toolName ? "Review your product profile" : "Manage your partner features",
        description: toolName ? "Check the details shown on your public listing and keep pricing and feature information current." : "Use the Founder Dashboard to manage your partner features.",
      },
      {
        tag: "SPONSORED PLACEMENT",
        title: "Promotion is clearly disclosed",
        description: "Paid placements are labeled as sponsored. Placement does not guarantee clicks, conversions, or sales.",
      },
      {
        tag: "LISTING ANALYTICS",
        title: "Track outbound interest",
        description: "Use your Founder Dashboard to review the available outbound click data for your listing.",
      },
    ],
    ctaText: "Open Founder Dashboard",
    ctaUrl: "https://aitoolshubi.com/dashboard?mode=partner&tab=listing",
    secondaryNote: "Paid placement is a promotion, not a third-party security or quality certification.",
  });
}
export function buildFreeClaimedToolWelcomeEmailHtml(data: { companyName: string; toolName: string; website: string }): string {
  const companyName = escapeHtml(data.companyName || "there");
  const toolName = escapeHtml(data.toolName);
  const website = escapeHtml(data.website);

  return renderAitoolsCosmicEmail({
    badgeText: "CLAIM CONFIRMED · VERIFIED FOUNDER",
    badgeColor: "emerald",
    title: `${toolName} is Ready to Manage`,
    subtitle: `Hi ${companyName}, your free verified listing for ${toolName} (${website}) is active on AItools Hubi. Your founder management console is unlocked.`,
    highlightPillars: [
      {
        tag: "PROFILE ACCURACY",
        title: "Customize Your Software Profile",
        description: "Edit your tagline, key features, pricing tier (Free / Freemium / Paid), and official documentation link.",
      },
      {
        tag: "LIVE DISCOVERY",
        title: "Always Active at No Cost",
        description: "Your verified free listing remains permanently indexed across search filters and AI comparison charts.",
      },
      {
        tag: "FOUNDER TELEMETRY",
        title: "Track Engagement & Inquiries",
        description: "Analyze click-throughs from prospective buyers and AI operators directly from your Partner Console.",
      },
    ],
    ctaText: "Open Partner Console",
    ctaUrl: "https://aitoolshubi.com/dashboard?mode=partner&tab=listing",
    secondaryNote: "Need help configuring your profile or setting up your verified badge? Reply to this email and our team will assist you.",
  });
}

/** A deliberate, one-to-one upgrade invitation sent from the admin console. */
export function buildPartnershipUpgradePitchEmailHtml(data: { companyName: string; toolName: string }): string {
  const companyName = escapeHtml(data.companyName || "there");
  const toolName = data.toolName ? escapeHtml(data.toolName) : null;

  return renderAitoolsCosmicEmail({
    badgeText: "FEATURED PARTNER INVITATION",
    badgeColor: "purple",
    title: `Put ${toolName} in Front of 10,000+ AI Buyers`,
    subtitle: `Hi ${companyName}, your verified listing is active on AItools Hubi. We invite you to feature ${toolName} with top-of-category placement and prominent spotlight distribution.`,
    highlightPillars: [
      {
        tag: "PRIME POSITIONING",
        title: "Top-of-Category Sticky Spotlight",
        description: "Be the first product buyers see when searching for tools in your category, generating up to 8x more clicks.",
      },
      {
        tag: "NEWSLETTER BROADCAST",
        title: "Dedicated Editorial Drop Feature",
        description: "Showcased in our weekly email dispatch to active developers, AI builders, and software procurement teams.",
      },
      {
        tag: "MAXIMUM DISTRIBUTION",
        title: "Dofollow Authority Backlink",
        description: "Direct high-authority link with rich preview metadata to enhance search engine ranking and referral flow.",
      },
    ],
    ctaText: "View Featured Partner Plan ($19/mo)",
    ctaUrl: "https://aitoolshubi.com/pricing?tab=partner&checkout=featured",
    secondaryNote: "This upgrade is 100% optional. Your current verified listing remains active indefinitely at no cost.",
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}

export function buildAdminPartnershipAlertEmailHtml(data: { companyName: string; toolName: string; website: string; email: string; tier: string; description: string }): string {
  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="margin:0;padding:40px 16px;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:20px;border:1px solid #e4e4e7;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.03);">
      <tr>
        <td style="padding:32px 32px 24px;text-align:left;">
          <h1 style="font-size:18px;font-weight:800;letter-spacing:-0.3px;color:#09090b;margin:0 0 4px;">New Partnership Application</h1>
          <p style="font-size:13px;color:#71717a;margin:0;">Review request from ${data.companyName}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 32px;color:#09090b;">
          <table width="100%" border="0" cellpadding="8" cellspacing="0" style="font-size:13px;color:#09090b;background:#f4f4f5;border-radius:12px;border:1px solid #e4e4e7;margin-bottom:20px;">
            <tr><td style="width:100px;font-weight:700;color:#52525b;">Tool Name:</td><td style="font-weight:600;">${data.toolName}</td></tr>
            <tr><td style="font-weight:700;color:#52525b;">Company:</td><td>${data.companyName}</td></tr>
            <tr><td style="font-weight:700;color:#52525b;">Email:</td><td>${data.email}</td></tr>
            <tr><td style="font-weight:700;color:#52525b;">Website:</td><td><a href="${data.website}" style="color:#09090b;text-decoration:underline;">${data.website}</a></td></tr>
            <tr><td style="font-weight:700;color:#52525b;">Tier:</td><td><span style="display:inline-block;padding:2px 8px;background:#09090b;color:#ffffff;border-radius:6px;font-size:11px;font-weight:700;">${data.tier.toUpperCase()}</span></td></tr>
          </table>
          <p style="font-size:12px;color:#71717a;margin:0 0 20px;line-height:1.5;">${data.description || "No description provided."}</p>
          <table border="0" cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr>
              <td align="center" style="border-radius:12px;background:#09090b;">
                <a href="https://aitoolshubi.com/admin" target="_blank" style="display:inline-block;padding:12px 28px;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">Open Admin Dashboard →</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
}

/**
 * Replaces merge tags in text with actual recipient data.
 * Supported tags: {{NAME}}, {{FIRST_NAME}}, [Name], [First Name], {{name}}, {{first_name}}
 * Falls back to "there" if no name is available.
 */
export function replaceMergeTags(text: string, recipientName?: string): string {
  if (!text) return "";
  let cleanName = recipientName?.trim();

  // If the stored name looks like an email address, strip the domain
  if (cleanName && cleanName.includes("@")) {
    cleanName = cleanName.split("@")[0].replace(/[._-]/g, " ").trim();
  }

  // Capitalize nicely if lowercase
  if (cleanName && /^[a-z]+$/.test(cleanName)) {
    cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
  }

  const fullName = cleanName && cleanName.length > 0 ? cleanName : "there";
  const firstName = cleanName && cleanName.length > 0 ? cleanName.split(/\s+/)[0] : "there";

  return text
    .replace(/\{\{(?:full_?)?name\}\}/gi, fullName)
    .replace(/\{\{first_?name\}\}/gi, firstName)
    .replace(/\[(?:full\s*)?name\]/gi, fullName)
    .replace(/\[first\s*name\]/gi, firstName);
}

export function buildMarketingBroadcastEmailHtml(
  title: string,
  message: string,
  buttonText?: string,
  buttonUrl?: string,
  imageUrl?: string,
  recipientName?: string,
): string {
  // Apply merge-tag personalization (e.g. "Hey {{NAME}}" → "Hey Issam")
  const personalizedTitle = replaceMergeTags(title, recipientName);
  const personalizedMessage = replaceMergeTags(message, recipientName);
  const personalizedButton = buttonText ? replaceMergeTags(buttonText, recipientName) : undefined;

  // Parse message lines into smart cognitive cards and styled paragraphs
  const lines = personalizedMessage.split("\n");
  const parsedCards: Array<{ tag?: string; title: string; description: string }> = [];
  const paragraphs: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const bulletMatch = trimmed.match(/^([•\-\*]|\d+[\.)])\\s*(.+)$/);
    if (bulletMatch) {
      const content = bulletMatch[2];
      const colonIdx = content.indexOf(":");
      const dashIdx = content.indexOf(" — ");
      const splitIdx = colonIdx > 0 ? colonIdx : dashIdx;

      if (splitIdx > 0 && splitIdx < 50) {
        parsedCards.push({
          tag: "HIGHLIGHT",
          title: content.substring(0, splitIdx).trim(),
          description: content.substring(splitIdx + (colonIdx > 0 ? 1 : 3)).trim(),
        });
      } else {
        parsedCards.push({
          title: content.trim(),
          description: "",
        });
      }
    } else {
      paragraphs.push(trimmed);
    }
  }

  let formattedBody = "";
  if (paragraphs.length > 0) {
    formattedBody = paragraphs
      .map((p) => `<p style="font-size:14px;line-height:1.7;color:#cbd5e1;margin:0 0 14px;">${escapeHtml(p)}</p>`)
      .join("");
  }

  return renderAitoolsCosmicEmail({
    badgeText: "OFFICIAL DISPATCH",
    badgeColor: "cyan",
    title: personalizedTitle.trim(),
    bodyContent: formattedBody,
    highlightPillars: parsedCards.length > 0 ? parsedCards : undefined,
    featuredImageUrl: imageUrl?.trim() || undefined,
    ctaText: personalizedButton?.trim() || undefined,
    ctaUrl: buttonUrl?.trim() || undefined,
  });
}

export function buildWelcomeEmailHtml(name: string, plan: string): string {
  if (plan === "newsletter") {
    return buildNewsletterWelcomeEmailHtml(name);
  }
  return buildCommunityWelcomeEmailHtml(name);
}

export function buildPaymentReceiptEmailHtml(data: {
  email: string;
  orderId: string;
  planName: string;
  amount: string;
  interval: string;
  gateway?: string;
  nextRenewalDate?: string;
}): string {
  const renewal = data.nextRenewalDate || new Date(Date.now() + (data.interval === "yearly" ? 365 : 30) * 86400000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const dateStr = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  const invoiceTableHtml = `
  <table width="100%" border="0" cellpadding="12" cellspacing="0" style="background:#0f172a;border-radius:14px;border:1px solid #1e293b;margin-bottom:20px;font-size:13px;">
    <tr>
      <td style="color:#94a3b8;font-weight:600;width:38%;border-bottom:1px solid #1e293b;">Invoice / Order ID</td>
      <td style="color:#ffffff;font-weight:700;font-family:monospace;border-bottom:1px solid #1e293b;">${escapeHtml(data.orderId)}</td>
    </tr>
    <tr>
      <td style="color:#94a3b8;font-weight:600;border-bottom:1px solid #1e293b;">Plan & Frequency</td>
      <td style="color:#ffffff;font-weight:700;border-bottom:1px solid #1e293b;">${escapeHtml(data.planName)} (${escapeHtml(data.interval.toUpperCase())})</td>
    </tr>
    <tr>
      <td style="color:#94a3b8;font-weight:600;border-bottom:1px solid #1e293b;">Amount Paid</td>
      <td style="color:#34d399;font-weight:900;font-size:16px;border-bottom:1px solid #1e293b;">$${escapeHtml(data.amount)} USD</td>
    </tr>
    <tr>
      <td style="color:#94a3b8;font-weight:600;border-bottom:1px solid #1e293b;">Payment Method</td>
      <td style="color:#cbd5e1;font-weight:600;border-bottom:1px solid #1e293b;">${escapeHtml(data.gateway || "PayPal / Credit Card")}</td>
    </tr>
    <tr>
      <td style="color:#94a3b8;font-weight:600;border-bottom:1px solid #1e293b;">Billing Date</td>
      <td style="color:#cbd5e1;border-bottom:1px solid #1e293b;">${escapeHtml(dateStr)}</td>
    </tr>
    <tr>
      <td style="color:#94a3b8;font-weight:600;">Next Renewal</td>
      <td style="color:#cbd5e1;">${escapeHtml(renewal)}</td>
    </tr>
  </table>`;

  return renderAitoolsCosmicEmail({
    badgeText: "PAYMENT CONFIRMED",
    badgeColor: "emerald",
    title: "Thank You for Your Payment",
    subtitle: `Your subscription to ${escapeHtml(data.planName)} is active. Below is your official receipt and invoice confirmation.`,
    bodyContent: invoiceTableHtml,
    ctaText: "Open Your Active Workspace",
    ctaUrl: "https://aitoolshubi.com/dashboard",
    secondaryNote: "You can manage, upgrade, or cancel your subscription at any time directly in your Account Settings.",
  });
}

export async function fetchBrevoContacts(): Promise<{ email: string; name?: string; listIds?: number[] }[]> {
  const key = getKey();
  if (!key) return [];
  try {
    const res = await fetch(`${BREVO_BASE}/contacts?limit=50&offset=0`, {
      headers: {
        accept: "application/json",
        "api-key": key,
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      contacts?: Array<{
        email?: string;
        attributes?: { FIRSTNAME?: string; LASTNAME?: string; COMPANY?: string };
        listIds?: number[];
      }>;
    };
    return (data.contacts || []).map((c) => ({
      email: (c.email || "").toLowerCase().trim(),
      name: c.attributes?.FIRSTNAME
        ? `${c.attributes.FIRSTNAME} ${c.attributes.LASTNAME || ""}`.trim()
        : c.attributes?.COMPANY || undefined,
      listIds: c.listIds || [],
    }));
  } catch (err) {
    logger.warn({ err }, "[brevo] fetch contacts failed");
    return [];
  }
}

export function buildSignupVerificationEmailHtml(data: {
  name?: string;
  email: string;
  code: string;
  verificationUrl?: string;
}): string {
  const displayName = escapeHtml(data.name?.trim() || data.email.split("@")[0] || "there");
  const code = escapeHtml(data.code);

  const otpBoxHtml = `
  <div style="text-align:center;margin:24px 0;">
    <div style="display:inline-block;padding:18px 36px;background:#0f172a;border:2px solid rgba(56,189,248,0.4);border-radius:18px;box-shadow:0 8px 24px rgba(0,0,0,0.5);">
      <span style="font-size:38px;font-weight:900;letter-spacing:12px;color:#38bdf8;font-family:monospace;display:inline-block;padding-left:12px;">${code}</span>
    </div>
    <p style="font-size:12px;color:#94a3b8;margin:12px 0 0;">This one-time security code expires in 15 minutes.</p>
  </div>`;

  return renderAitoolsCosmicEmail({
    badgeText: "SECURITY VERIFICATION",
    badgeColor: "amber",
    title: "Verify Your Email Address",
    subtitle: `Hi ${displayName}, welcome to AItools Hubi! Please enter the 6-digit verification code below to complete your registration and activate your workspace.`,
    bodyContent: otpBoxHtml,
    highlightPillars: [
      {
        tag: "CURATED DIRECTORY",
        title: "500+ Verified AI Tools",
        description: "Benchmark testing on reasoning models, developer agents, and multimodal software.",
      },
      {
        tag: "COMMUNITY SIGNALS",
        title: "Creator Drops & Real Feedback",
        description: "Direct discussions with software founders, transparent pricing, and genuine user reviews.",
      },
      {
        tag: "FOUNDER SUITE",
        title: "Verified Founder Telemetry",
        description: "Claim your software listing and track outbound traffic with verified badges.",
      },
    ],
    ctaText: data.verificationUrl ? "Verify & Activate Account" : undefined,
    ctaUrl: data.verificationUrl || undefined,
    secondaryNote: "If you did not initiate this request, you can safely ignore this email.",
  });
}

export function buildSignupSuccessEmailHtml(data: {
  name?: string;
  email: string;
  role?: string;
}): string {
  const displayName = escapeHtml(data.name?.trim() || data.email.split("@")[0] || "there");
  const isPartner = data.role === "partner";

  return renderAitoolsCosmicEmail({
    badgeText: "WORKSPACE ACTIVATED",
    badgeColor: "emerald",
    title: "Account Activated Successfully",
    subtitle: `Hi ${displayName}, your email address has been verified and your AItools Hubi workspace is officially active and secured.`,
    highlightPillars: isPartner
      ? [
          {
            tag: "FOUNDER CONSOLE",
            title: "Manage Your Tool Listings",
            description: "Customize your product description, docs URL, pricing tiers, and embed verified badges.",
          },
          {
            tag: "TRAFFIC TELEMETRY",
            title: "Track Live Referral Clicks",
            description: "Analyze daily views, outbound click-throughs, and bookmark engagement across the directory.",
          },
          {
            tag: "COMMUNITY UPDATES",
            title: "Broadcast to Live Feed",
            description: "Publish your product launches and major version releases directly to active AI buyers.",
          },
        ]
      : [
          {
            tag: "STACK BUILDER",
            title: "Personal AI Stack Library",
            description: "Save, compare, and organize your daily software stack with personal tags and notes.",
          },
          {
            tag: "HUBI AI ARCHITECT",
            title: "Instant Tool Recommendations",
            description: "Consult Hubi AI anytime for tailored stack architectures and workflow suggestions.",
          },
          {
            tag: "PRODUCTION BLUEPRINTS",
            title: "Curated Workflows & Prompts",
            description: "Access complete recipes combining frontier models with Cursor, v0, and Next.js.",
          },
        ],
    ctaText: "Open Workspace Now",
    ctaUrl: isPartner ? "https://aitoolshubi.com/dashboard?mode=partner&tab=listing" : "https://aitoolshubi.com/dashboard",
    secondaryNote: "Need assistance or have feedback? Reply directly to this email at any time.",
  });
}
