import type { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { createClient, type User } from "@supabase/supabase-js";
import { getUserProfile, type DbUserProfile } from "./db-fallback.js";
import { getAccountEntitlements, hasCommunityEntitlement, type AccountEntitlements } from "./entitlements.js";
import { logger } from "./logger.js";

export interface AuthenticatedRequest extends Request {
  authUser?: User;
  profile?: DbUserProfile | null;
  entitlements?: AccountEntitlements;
}

// This module is imported while the API is assembled, before index.ts starts
// listening. Load just the public local Supabase values here when developing so
// token verification is ready from the first request.
if (process.env["NODE_ENV"] !== "production" && !process.env["SUPABASE_URL"]) {
  const frontendEnvPath = path.resolve(process.cwd(), "..", "aitoolshubi", ".env");
  if (fs.existsSync(frontendEnvPath)) {
    for (const line of fs.readFileSync(frontendEnvPath, "utf-8").split("\n")) {
      const trimmed = line.trim();
      const eqIdx = trimmed.indexOf("=");
      if (!trimmed || trimmed.startsWith("#") || eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim().replace(/^[\"']|[\"']$/g, "");
      if (key === "VITE_SUPABASE_URL") process.env["SUPABASE_URL"] = value;
      if (key === "VITE_SUPABASE_ANON_KEY") process.env["SUPABASE_ANON_KEY"] = value;
    }
  }
}

const supabaseUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "";
// getUser(token) verifies the session with Supabase. A server service-role key is
// preferred, but the public anon key is sufficient for this verification call.
// It never grants database-admin access to this API.
const supabaseVerificationKey =
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
  process.env["SUPABASE_ANON_KEY"] ||
  process.env["VITE_SUPABASE_ANON_KEY"] ||
  "";

export const AUTH_CONFIGURED = Boolean(supabaseUrl && supabaseVerificationKey);

/**
 * The JSON-backed account store exists only to make local UI development
 * possible. It is deliberately opt-in so a production deployment can never
 * authenticate a request from a caller-controlled email header.
 */
export const DEVELOPMENT_AUTH_FALLBACK_ENABLED =
  process.env["NODE_ENV"] !== "production" && process.env["AUTH_ALLOW_DEV_FALLBACK"] === "true";

export const supabaseAdmin = AUTH_CONFIGURED
  ? createClient(supabaseUrl, supabaseVerificationKey, { auth: { persistSession: false } })
  : null;

export async function createUserInSupabase(user: {
  email: string;
  password?: string;
  name?: string;
  username?: string;
  role?: string;
}): Promise<{ id: string; email: string } | null> {
  if (!supabaseAdmin) return null;
  try {
    const normalizedEmail = user.email.toLowerCase().trim();
    const userMetadata = {
      name: user.name || normalizedEmail.split("@")[0],
      full_name: user.name || normalizedEmail.split("@")[0],
      username: user.username || normalizedEmail.split("@")[0],
      role: user.role || "member",
    };

    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (!listError && listData?.users) {
      const existing = listData.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
      if (existing) {
        const updatePayload: Record<string, unknown> = {
          email_confirm: true,
          user_metadata: { ...(existing.user_metadata || {}), ...userMetadata },
        };
        if (user.password) {
          updatePayload["password"] = user.password;
        }
        const { data: updated, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existing.id, updatePayload);
        if (!updateError && updated.user) {
          logger.info({ email: normalizedEmail, id: updated.user.id }, "[auth] User profile & status synced to Supabase");
          return { id: updated.user.id, email: normalizedEmail };
        }
        return { id: existing.id, email: normalizedEmail };
      }
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: user.password,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    if (!createError && created.user) {
      logger.info({ email: normalizedEmail, id: created.user.id }, "[auth] New verified user created and saved in Supabase");
      return { id: created.user.id, email: normalizedEmail };
    } else if (createError) {
      logger.warn({ error: createError.message, email: normalizedEmail }, "[auth] Supabase admin.createUser notice");
    }
  } catch (err: any) {
    logger.warn({ err: err.message, email: user.email }, "[auth] Supabase user creation notice");
  }
  return null;
}

export async function syncUserPasswordToSupabase(email: string, newPassword: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (!error && data?.users) {
      const existing = data.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
      if (existing) {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
          password: newPassword,
          email_confirm: true,
        });
        if (!updateError) {
          logger.info({ email: normalizedEmail }, "[auth] Password successfully synced to Supabase");
          return true;
        }
      } else {
        const { error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password: newPassword,
          email_confirm: true,
        });
        if (!createError) {
          logger.info({ email: normalizedEmail }, "[auth] User created and synced to Supabase");
          return true;
        }
      }
    }
  } catch (err) {
    logger.warn({ err, email }, "[auth] Supabase password sync skipped (service role key not configured or permissions)");
  }
  return false;
}

export async function getSupabaseAuthUsers(): Promise<{ id: string; email: string; name?: string; createdAt?: string; provider?: string }[]> {
  if (!supabaseAdmin) return [];
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) {
      logger.warn({ error: error.message || error }, "[auth] supabaseAdmin.auth.admin.listUsers failed (ensure SUPABASE_SERVICE_ROLE_KEY is set in environment)");
      return [];
    }
    if (!data?.users) return [];
    return data.users
      .filter((u) => Boolean(u.email))
      .map((u) => ({
        id: u.id,
        email: u.email!.toLowerCase().trim(),
        name: (u.user_metadata?.full_name || u.user_metadata?.name || u.user_metadata?.user_name || "").trim() || undefined,
        createdAt: u.created_at,
        provider: u.app_metadata?.provider,
      }));
  } catch (err) {
    logger.warn({ err }, "[auth] Failed to fetch Supabase users list");
    return [];
  }
}

function getAdminEmails(): Set<string> {
  const raw = process.env["ADMIN_EMAILS"] || "";
  return new Set(raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
}

export function makeSessionToken(user: { id: string; email: string; name?: string; username?: string; role?: string }): string {
  const payload = {
    id: user.id,
    email: user.email.toLowerCase().trim(),
    name: user.name,
    username: user.username,
    role: user.role,
    iat: Date.now(),
  };
  return `aitoolshubi_${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
}

export function decodeSessionToken(token: string): User | null {
  try {
    const rawStr = token.startsWith("aitoolshubi_") ? token.slice("aitoolshubi_".length) : token;
    const jsonStr = Buffer.from(rawStr, "base64url").toString("utf-8");
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed.email === "string" && parsed.email.includes("@")) {
      const email = parsed.email.toLowerCase().trim();
      return {
        id: parsed.id || `usr-${email}`,
        email,
        user_metadata: { name: parsed.name || parsed.username || email.split("@")[0] },
        app_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      } as User;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function verifyBearerToken(authHeader: string | undefined): Promise<User | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  // Unsigned local session tokens are accepted only when an operator explicitly
  // enables the development fallback. Production sessions must be verified by
  // Supabase before they can access merchant or payment operations.
  if (DEVELOPMENT_AUTH_FALLBACK_ENABLED) {
    const localUser = decodeSessionToken(token);
    if (localUser?.email) return localUser;
  }

  // 2. Try Supabase verification if configured
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data.user?.email) return data.user;
    } catch (err) {
      logger.warn({ err }, "[auth] Supabase token verification failed");
    }
  }

  return null;
}

async function attachProfile(req: AuthenticatedRequest): Promise<void> {
  if (!req.authUser?.email) {
    req.profile = null;
    return;
  }
  req.profile = await getUserProfile(req.authUser.email);
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  void (async () => {
    let user = await verifyBearerToken(req.header("authorization") || undefined);
    if (!user?.email && DEVELOPMENT_AUTH_FALLBACK_ENABLED) {
      const fallbackEmail = req.header("x-user-email") || req.header("x-dev-email") || (req.query["email"] as string);
      if (fallbackEmail && typeof fallbackEmail === "string" && fallbackEmail.includes("@")) {
        const normalized = fallbackEmail.toLowerCase().trim();
        user = {
          id: `usr-${normalized}`,
          email: normalized,
          user_metadata: { name: normalized.split("@")[0] },
          app_metadata: {},
          aud: "authenticated",
          created_at: new Date().toISOString(),
        } as User;
      }
    }
    if (user?.email) {
      req.authUser = user;
      await attachProfile(req);
    }
    next();
  })().catch((err) => {
    logger.error({ err }, "[auth] optionalAuth failed");
    next();
  });
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  void (async () => {
    let user = await verifyBearerToken(req.header("authorization") || undefined);
    if (!user?.email && DEVELOPMENT_AUTH_FALLBACK_ENABLED) {
      const fallbackEmail = req.header("x-user-email") || req.header("x-dev-email") || (req.query["email"] as string);
      if (fallbackEmail && typeof fallbackEmail === "string" && fallbackEmail.includes("@")) {
        const normalized = fallbackEmail.toLowerCase().trim();
        user = {
          id: `usr-${normalized}`,
          email: normalized,
          user_metadata: { name: normalized.split("@")[0] },
          app_metadata: {},
          aud: "authenticated",
          created_at: new Date().toISOString(),
        } as User;
      }
    }
    if (!user?.email) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    req.authUser = user;
    await attachProfile(req);
    next();
  })().catch((err) => {
    logger.error({ err }, "[auth] requireAuth failed");
    res.status(500).json({ error: "Authentication error" });
  });
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  void (async () => {
    const user = await verifyBearerToken(req.header("authorization") || undefined);
    if (user?.email) {
      req.authUser = user;
      await attachProfile(req);
      const adminEmails = getAdminEmails();
      if (adminEmails.has(user.email.toLowerCase())) {
        next();
        return;
      }
    }
    res.status(403).json({ error: "Admin access required" });
  })().catch((err) => {
    logger.error({ err }, "[auth] requireAdmin failed");
    res.status(500).json({ error: "Authorization error" });
  });
}

export async function isPaidMember(email: string): Promise<boolean> {
  const entitlements = await getAccountEntitlements(email);
  return hasCommunityEntitlement(entitlements);
}

export function requireMember(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    void (async () => {
      const email = req.authUser?.email;
      if (!email) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const paid = await isPaidMember(email);
      if (!paid) {
        res.status(403).json({ error: "Active community membership required" });
        return;
      }
      next();
    })();
  });
}

export function requirePartner(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    void (async () => {
      const email = req.authUser?.email?.toLowerCase();
      const adminEmails = getAdminEmails();
      const isAdmin = req.profile?.role === "admin" || Boolean(email && adminEmails.has(email));
      const entitlements = await getAccountEntitlements(req.authUser!.email!);
      req.entitlements = entitlements;
      if (!isAdmin && !entitlements.partner.active) {
        res.status(403).json({ error: "An approved active partnership is required" });
        return;
      }
      next();
    })().catch((err) => {
      logger.error({ err }, "[auth] requirePartner failed");
      res.status(500).json({ error: "Authorization error" });
    });
  });
}
