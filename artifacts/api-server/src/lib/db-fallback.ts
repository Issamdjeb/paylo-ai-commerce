import {
  db,
  communitySignups,
  partnershipApplications,
  userProfiles,
} from "@workspace/db";
import { eq, desc, and, or } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Bundled output lives in artifacts/api-server/dist — data/ is a sibling folder.
const ARTIFACT_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = process.env["API_DATA_DIR"] || path.join(ARTIFACT_ROOT, "data");
const SIGNUPS_FILE = path.join(DATA_DIR, "community-signups.json");
const APPS_FILE = path.join(DATA_DIR, "partnership-applications.json");

let isDbAvailable = false;
let dbCheckPromise: Promise<boolean> | null = null;

async function checkDbConnection(): Promise<boolean> {
  if (dbCheckPromise) return dbCheckPromise;
  
  dbCheckPromise = (async () => {
    const url = process.env["DATABASE_URL"];
    if (!url || url.includes("localhost:5432/dummy") || url.includes("dummy")) {
      console.warn("DATABASE_URL is not set or is using dummy database. Falling back to JSON storage.");
      return false;
    }
    try {
      // Run a simple query to verify connection
      await db.execute("SELECT 1");
      isDbAvailable = true;
      console.log("Successfully connected to PostgreSQL database.");
      return true;
    } catch (err) {
      console.warn("Database connection failed. Falling back to JSON storage.", err);
      return false;
    }
  })();
  
  return dbCheckPromise;
}

// Initial DB check on startup
checkDbConnection().catch(() => {});

export async function getStorageInfo(): Promise<{ backend: "postgres" | "json"; dataDir: string }> {
  const useDb = await checkDbConnection();
  return {
    backend: useDb ? "postgres" : "json",
    dataDir: DATA_DIR,
  };
}

// ─── HELPERS ────────────────────────────────────────────────────────

export function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function readJson<T>(file: string): T[] {
  try {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T[];
  } catch {
    return [];
  }
}

export function writeJson<T>(file: string, data: T[]): void {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ─── COMMUNITY SIGNUPS ─────────────────────────────────────────────

export interface DbSignup {
  id: string;
  email: string;
  name: string;
  plan: string;
  createdAt: string;
}

function loadJsonSignups(): DbSignup[] { return readJson<DbSignup>(SIGNUPS_FILE); }
function saveJsonSignups(signups: DbSignup[]): void { writeJson(SIGNUPS_FILE, signups); }

export async function getCommunitySignups(): Promise<DbSignup[]> {
  const useDb = await checkDbConnection();
  if (useDb) {
    try {
      const records = await db.select().from(communitySignups).orderBy(desc(communitySignups.createdAt));
      return records.map(r => ({
        id: r.id,
        email: r.email,
        name: r.name || "",
        plan: r.plan,
        createdAt: r.createdAt.toISOString(),
      }));
    } catch (err) {
      console.error("DB query failed, falling back to JSON", err);
    }
  }
  return [...loadJsonSignups()].reverse();
}

export async function addCommunitySignup(data: { email: string; name: string; plan: string }): Promise<{
  success: boolean;
  alreadyExists: boolean;
  upgraded: boolean;
  message: string;
  signup?: DbSignup;
}> {
  const useDb = await checkDbConnection();
  const normalizedEmail = data.email.toLowerCase().trim();
  const normalizedName = data.name.trim();
  const normalizedPlan = data.plan.trim() || "pro";

  if (useDb) {
    try {
      const existing = await db.select().from(communitySignups).where(eq(communitySignups.email, normalizedEmail)).limit(1);
      if (existing.length > 0) {
        const current = existing[0];
        const upgraded = await maybeUpgradeSignupPlan(current, normalizedPlan, normalizedName);
        return {
          success: true,
          alreadyExists: true,
          upgraded,
          message: upgraded
            ? "Your membership has been upgraded! Check your inbox for the welcome email."
            : "You're already on the list! Check your inbox for the next steps.",
          signup: {
            id: current.id,
            email: current.email,
            name: upgraded ? normalizedName || current.name || "" : current.name || "",
            plan: upgraded ? normalizedPlan : current.plan,
            createdAt: current.createdAt.toISOString(),
          },
        };
      }
      const inserted = await db.insert(communitySignups).values({
        email: normalizedEmail,
        name: normalizedName,
        plan: normalizedPlan,
      }).returning();
      const record = inserted[0];
      return {
        success: true,
        alreadyExists: false,
        upgraded: false,
        message: normalizedPlan === "newsletter"
          ? "You're subscribed! Weekly AI tool drops incoming."
          : "You're on the list! Check your inbox for a confirmation email.",
        signup: record ? {
          id: record.id,
          email: record.email,
          name: record.name || "",
          plan: record.plan,
          createdAt: record.createdAt.toISOString(),
        } : undefined,
      };
    } catch (err) {
      console.error("DB insert failed, falling back to JSON", err);
    }
  }

  const signups = loadJsonSignups();
  const existingIndex = signups.findIndex((s) => s.email.toLowerCase() === normalizedEmail);
  if (existingIndex >= 0) {
    const current = signups[existingIndex];
    const upgraded = applyPlanUpgrade(current, normalizedPlan, normalizedName);
    if (upgraded) saveJsonSignups(signups);
    return {
      success: true,
      alreadyExists: true,
      upgraded,
      message: upgraded
        ? "Your membership has been upgraded! Check your inbox for the welcome email."
        : "You're already on the list! Check your inbox for the next steps.",
      signup: current,
    };
  }

  const newSignup: DbSignup = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    name: normalizedName,
    plan: normalizedPlan,
    createdAt: new Date().toISOString(),
  };
  signups.push(newSignup);
  saveJsonSignups(signups);

  return {
    success: true,
    alreadyExists: false,
    upgraded: false,
    message: normalizedPlan === "newsletter"
      ? "You're subscribed! Weekly AI tool drops incoming."
      : "You're on the list! Check your inbox for a confirmation email.",
    signup: newSignup,
  };
}

function isCommunityPlan(plan: string): boolean {
  return plan !== "newsletter";
}

function applyPlanUpgrade(signup: DbSignup, newPlan: string, newName: string): boolean {
  if (isCommunityPlan(newPlan) && signup.plan === "newsletter") {
    signup.plan = newPlan;
    if (newName) signup.name = newName;
    return true;
  }
  if (newName && !signup.name) signup.name = newName;
  return false;
}

async function maybeUpgradeSignupPlan(
  current: { id: string; email: string; name: string | null; plan: string; createdAt: Date },
  newPlan: string,
  newName: string,
): Promise<boolean> {
  if (!isCommunityPlan(newPlan) || current.plan !== "newsletter") {
    if (newName && !current.name) {
      await db.update(communitySignups)
        .set({ name: newName })
        .where(eq(communitySignups.id, current.id));
    }
    return false;
  }
  await db.update(communitySignups)
    .set({
      plan: newPlan,
      ...(newName ? { name: newName } : {}),
    })
    .where(eq(communitySignups.id, current.id));
  return true;
}

export async function deleteCommunitySignup(id: string): Promise<boolean> {
  let dbDeleted = false;
  const useDb = await checkDbConnection();
  if (useDb) {
    try {
      const deleted = await db.delete(communitySignups).where(eq(communitySignups.id, id)).returning();
      if (deleted.length > 0) dbDeleted = true;
    } catch (err) {
      console.error("DB delete failed, falling back to JSON", err);
    }
  }

  const signups = loadJsonSignups();
  const next = signups.filter((s) => s.id !== id);
  if (next.length !== signups.length) {
    saveJsonSignups(next);
    return true;
  }
  return dbDeleted;
}

// ─── PARTNERSHIP APPLICATIONS ───────────────────────────────────────

export interface DbApplication {
  id: string;
  companyName: string;
  toolName: string;
  website: string;
  email: string;
  tier: string;
  description: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

const AITOOLS_HUBI_OWNER_EMAIL = "issam@aitoolshubi.com";

/** Remove only the old local preview duplicates and preserve one official, editable Hubi listing.
 *
 * This function runs on every listing read.  It must never "repair" the
 * official listing by overwriting its fields: doing that made a successful
 * Tool Management save disappear at the next refresh.
 */
function loadJsonApps(): DbApplication[] {
  const apps = readJson<DbApplication>(path.join(DATA_DIR, "partnership-applications.json"));
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  const officialNames = new Set(["aitools hubi", "aitoolshubi", "ai tools hubi"]);
  const legacyTestNames = new Set(["issamai", "aitools"]);
  const cleaned = apps.filter((application) => !(
    normalize(application.email) === AITOOLS_HUBI_OWNER_EMAIL && legacyTestNames.has(normalize(application.toolName))
  ));

  if (cleaned.length !== apps.length) saveJsonApps(cleaned);
  return cleaned;
}
function saveJsonApps(apps: DbApplication[]): void { writeJson(path.join(DATA_DIR, "partnership-applications.json"), apps); }

export async function getPartnershipApplications(): Promise<DbApplication[]> {
  const useDb = await checkDbConnection();
  if (useDb) {
    try {
      const records = await db.select().from(partnershipApplications).orderBy(desc(partnershipApplications.createdAt));
      return records.map(r => ({
        id: r.id,
        companyName: r.companyName,
        toolName: r.toolName,
        website: r.website,
        email: r.email,
        tier: r.tier,
        description: r.description,
        status: r.status as "pending" | "approved" | "rejected",
        createdAt: r.createdAt.toISOString(),
      }));
    } catch (err) {
      console.error("DB query failed, falling back to JSON", err);
    }
  }
  return [...loadJsonApps()].reverse();
}

export async function addPartnershipApplication(data: {
  companyName: string;
  toolName: string;
  website: string;
  email: string;
  tier: string;
  description: string;
  status?: DbApplication["status"];
}): Promise<{ success: boolean; alreadyExists: boolean; message: string }> {
  const useDb = await checkDbConnection();
  const normalizedEmail = data.email.toLowerCase().trim();
  const normalizedToolName = data.toolName.trim();
  const initialStatus: DbApplication["status"] = data.status || "pending";

  if (useDb) {
    try {
      const existing = await db.select().from(partnershipApplications)
        .where(
          and(
            eq(partnershipApplications.email, normalizedEmail),
            eq(partnershipApplications.toolName, normalizedToolName)
          )
        )
        .limit(1);
      if (existing.length > 0) {
        return {
          success: true,
          alreadyExists: true,
          message: "We already have your application. Our team will reply within 48 hours.",
        };
      }
      await db.insert(partnershipApplications).values({
        companyName: data.companyName.trim(),
        toolName: normalizedToolName,
        website: data.website.trim(),
        email: normalizedEmail,
        tier: data.tier || "featured",
        description: data.description.trim(),
        status: initialStatus,
      });
      return {
        success: true,
        alreadyExists: false,
        message: "Tool listing published successfully!",
      };
    } catch (err) {
      console.error("DB insert failed, falling back to JSON", err);
    }
  }

  const apps = loadJsonApps();
  const duplicate = apps.find(
    (a) =>
      a.email.toLowerCase() === normalizedEmail &&
      a.toolName.toLowerCase() === normalizedToolName.toLowerCase(),
  );

  if (duplicate) {
    // If it already exists, update its details and keep approved
    duplicate.companyName = data.companyName.trim();
    duplicate.website = data.website.trim();
    duplicate.description = data.description.trim();
    duplicate.tier = data.tier || duplicate.tier;
    if (data.status) duplicate.status = data.status;
    saveJsonApps(apps);
    return {
      success: true,
      alreadyExists: true,
      message: "Tool listing details updated successfully!",
    };
  }

  apps.push({
    id: crypto.randomUUID(),
    companyName: data.companyName.trim(),
    toolName: normalizedToolName,
    website: data.website.trim(),
    email: normalizedEmail,
    tier: data.tier || "featured",
    description: data.description.trim(),
    status: initialStatus,
    createdAt: new Date().toISOString(),
  });
  saveJsonApps(apps);

  return {
    success: true,
    alreadyExists: false,
    message: "Tool listing published successfully!",
  };
}

export async function updatePartnershipApplicationStatus(id: string, status: DbApplication["status"]): Promise<DbApplication | null> {
  let dbResult: DbApplication | null = null;
  const useDb = await checkDbConnection();
  if (useDb) {
    try {
      const updated = await db.update(partnershipApplications)
        .set({ status })
        .where(eq(partnershipApplications.id, id))
        .returning();
      if (updated.length > 0) {
        const r = updated[0];
        dbResult = {
          id: r.id,
          companyName: r.companyName,
          toolName: r.toolName,
          website: r.website,
          email: r.email,
          tier: r.tier,
          description: r.description,
          status: r.status as "pending" | "approved" | "rejected",
          createdAt: r.createdAt.toISOString(),
        };
        return dbResult;
      }
    } catch (err) {
      console.error("DB update failed, falling back to JSON", err);
    }
  }

  const apps = loadJsonApps();
  const app = apps.find((a) => a.id === id);
  if (app) {
    app.status = status;
    saveJsonApps(apps);
    return app;
  }
  return dbResult;
}

export async function updateApprovedPartnerListing(
  id: string,
  email: string,
  data: { companyName?: string; toolName?: string; website?: string; description?: string; tier?: string; status?: DbApplication["status"] },
): Promise<DbApplication | null> {
  const normalizedEmail = email.toLowerCase().trim();
  let dbResult: DbApplication | null = null;
  const useDb = await checkDbConnection();
  if (useDb) {
    try {
      const updated = await db
        .update(partnershipApplications)
        .set({
          ...(data.companyName !== undefined ? { companyName: data.companyName.trim() } : {}),
          ...(data.toolName !== undefined ? { toolName: data.toolName.trim() } : {}),
          ...(data.website !== undefined ? { website: data.website.trim() } : {}),
          ...(data.description !== undefined ? { description: data.description.trim() } : {}),
          ...(data.tier !== undefined ? { tier: data.tier } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
        })
        .where(
          and(
            eq(partnershipApplications.id, id),
            eq(partnershipApplications.email, normalizedEmail),
            or(
              eq(partnershipApplications.status, "approved"),
              eq(partnershipApplications.status, "pending"),
            ),
          ),
        )
        .returning();
      if (updated.length > 0) {
        const application = updated[0]!;
        dbResult = {
          id: application.id,
          companyName: application.companyName,
          toolName: application.toolName,
          website: application.website,
          email: application.email,
          tier: application.tier,
          description: application.description,
          status: application.status as DbApplication["status"],
          createdAt: application.createdAt.toISOString(),
        };
      }
    } catch (err) {
      console.error("DB listing update failed, falling back to JSON", err);
    }
  }

  // Always keep JSON fallback storage perfectly synchronized
  const apps = loadJsonApps();
  let application = apps.find(
    (item) => item.id === id && item.email.toLowerCase() === normalizedEmail,
  );

  // If not found by exact id, match by user email (handles synthetic partner-tool-1 or tool rename)
  if (!application) {
    const userApps = apps.filter((item) => item.email.toLowerCase() === normalizedEmail);
    if (userApps.length === 1 || id === "partner-tool-1" || !id) {
      application = userApps[0];
    } else if (data.toolName) {
      application = userApps.find((item) => item.toolName.toLowerCase() === data.toolName!.toLowerCase());
    }
  }

  if (application) {
    if (data.companyName !== undefined) application.companyName = data.companyName.trim();
    if (data.toolName !== undefined) application.toolName = data.toolName.trim();
    if (data.website !== undefined) application.website = data.website.trim();
    if (data.description !== undefined) application.description = data.description.trim();
    if (data.tier !== undefined) application.tier = data.tier;
    if (data.status !== undefined) application.status = data.status;
    saveJsonApps(apps);
    return application;
  }

  // If no application existed yet for this founder, create and persist it now!
  const newApp: DbApplication = {
    id: (id && id !== "partner-tool-1") ? id : crypto.randomUUID(),
    companyName: (data.companyName || data.toolName || "My AI Tool").trim(),
    toolName: (data.toolName || "My AI Tool").trim(),
    website: (data.website || "https://aitoolshubi.com").trim(),
    email: normalizedEmail,
    tier: data.tier || "featured",
    description: (data.description || "").trim(),
    status: data.status || "approved",
    createdAt: new Date().toISOString(),
  };
  apps.push(newApp);
  saveJsonApps(apps);
  return newApp;
}

/** Activate the paid distribution tier on every approved listing managed by the buyer. */
export async function updatePartnerTierByOwner(email: string, tier: "featured" | "premium"): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const useDb = await checkDbConnection();
  if (useDb) {
    try {
      await db
        .update(partnershipApplications)
        .set({ tier })
        .where(and(eq(partnershipApplications.email, normalizedEmail), eq(partnershipApplications.status, "approved")));
      return;
    } catch (err) {
      console.error("DB partner tier update failed, falling back to JSON", err);
    }
  }
  const applications = loadJsonApps();
  let changed = false;
  for (const application of applications) {
    if (application.email.toLowerCase() === normalizedEmail && application.status === "approved") {
      application.tier = tier;
      changed = true;
    }
  }
  if (changed) saveJsonApps(applications);
}

export async function deletePartnershipApplication(id: string): Promise<boolean> {
  let dbDeleted = false;
  const useDb = await checkDbConnection();
  if (useDb) {
    try {
      const deleted = await db.delete(partnershipApplications).where(eq(partnershipApplications.id, id)).returning();
      if (deleted.length > 0) dbDeleted = true;
    } catch (err) {
      console.error("DB delete failed, falling back to JSON", err);
    }
  }

  const apps = loadJsonApps();
  const next = apps.filter((a) => a.id !== id);
  if (next.length !== apps.length) {
    saveJsonApps(next);
    return true;
  }
  return dbDeleted;
}

/** Delete a listing only when the requesting owner matches the stored email. */
export async function deletePartnershipApplicationByOwner(toolName: string, email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedToolName = toolName.toLowerCase().trim();
  const applications = await getPartnershipApplications();
  const application = applications.find(
    (item) =>
      item.toolName.toLowerCase().trim() === normalizedToolName &&
      item.email.toLowerCase().trim() === normalizedEmail,
  );
  return application ? deletePartnershipApplication(application.id) : false;
}



// ───────────────────────────────────────────────────────────────────
// USER PROFILES — role-based accounts
// ───────────────────────────────────────────────────────────────────

const PROFILES_FILE = path.join(DATA_DIR, "user-profiles.json");

export interface DbUserProfile {
  id: string;
  email: string;
  name: string;
  username?: string | null;
  role: "member" | "partner" | "creator" | "admin";
  subscriptionStatus: "active" | "trialing" | "past_due" | "canceled" | "none";
  subscriptionId: string | null;
  priceId: string | null;
  toolName: string | null;
  companyName: string | null;
  avatarUrl: string | null;
  bannerUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

function loadProfiles(): DbUserProfile[] { return readJson<DbUserProfile>(PROFILES_FILE); }
function saveProfiles(profiles: DbUserProfile[]): void { writeJson(PROFILES_FILE, profiles); }

function mapDbUserProfile(row: {
  id: string;
  email: string;
  name: string | null;
  role: string;
  subscriptionStatus: string;
  subscriptionId: string | null;
  priceId: string | null;
  toolName: string | null;
  companyName: string | null;
  avatarUrl: string | null;
  bannerUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): DbUserProfile {
  const defaultUsername = row.email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "");
  return {
    id: row.id,
    email: row.email,
    name: row.name || "",
    username: defaultUsername,
    role: row.role as DbUserProfile["role"],
    subscriptionStatus: row.subscriptionStatus as DbUserProfile["subscriptionStatus"],
    subscriptionId: row.subscriptionId,
    priceId: row.priceId,
    toolName: row.toolName,
    companyName: row.companyName,
    avatarUrl: row.avatarUrl,
    bannerUrl: row.bannerUrl || null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function findUserProfileByUsername(username: string, excludeEmail?: string): DbUserProfile | null {
  const normalized = username.toLowerCase().trim().replace(/[^a-z0-9_]/g, "");
  if (!normalized) return null;
  const profiles = loadProfiles();
  const normalizedExclude = excludeEmail ? excludeEmail.toLowerCase().trim() : null;
  return (
    profiles.find(
      (p) =>
        (normalizedExclude ? p.email.toLowerCase().trim() !== normalizedExclude : true) &&
        ((p.username && p.username.toLowerCase() === normalized) ||
        (!p.username && p.email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "") === normalized))
    ) || null
  );
}

export async function upsertUserProfile(data: {
  email: string;
  name?: string;
  username?: string;
  supabaseUserId?: string;
  toolName?: string;
  companyName?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  role?: "member" | "partner" | "creator" | "admin";
  subscriptionStatus?: "active" | "trialing" | "past_due" | "canceled" | "none";
}): Promise<DbUserProfile> {
  const normalized = data.email.toLowerCase().trim();
  const useDb = await checkDbConnection();

  if (useDb) {
    try {
      const existing = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.email, normalized))
        .limit(1);

      if (existing.length > 0) {
        const current = existing[0]!;
        const updated = await db
          .update(userProfiles)
          .set({
            ...(data.name ? { name: data.name } : {}),
            ...(data.supabaseUserId ? { supabaseUserId: data.supabaseUserId } : {}),
            ...(data.toolName !== undefined ? { toolName: data.toolName } : {}),
            ...(data.companyName !== undefined ? { companyName: data.companyName } : {}),
            ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
            updatedAt: new Date(),
          })
          .where(eq(userProfiles.id, current.id))
          .returning();
        const profile = mapDbUserProfile(updated[0]!);
        if (data.username) profile.username = data.username.toLowerCase().trim().replace(/[^a-z0-9_]/g, "");
        return profile;
      }

      const inserted = await db
        .insert(userProfiles)
        .values({
          email: normalized,
          name: data.name || "",
          supabaseUserId: data.supabaseUserId,
          toolName: data.toolName || null,
          companyName: data.companyName || null,
          avatarUrl: data.avatarUrl || null,
        })
        .returning();
      const profile = mapDbUserProfile(inserted[0]!);
      if (data.username) profile.username = data.username.toLowerCase().trim().replace(/[^a-z0-9_]/g, "");
      return profile;
    } catch (err) {
      console.error("DB upsertUserProfile failed, falling back to JSON", err);
    }
  }

  const profiles = loadProfiles();
  const idx = profiles.findIndex((p) => p.email.toLowerCase() === normalized);
  const now = new Date().toISOString();
  const defaultUsername = normalized.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "");

  if (idx >= 0) {
    const existing = profiles[idx];
    if (data.name) existing.name = data.name;
    if (data.username) existing.username = data.username.toLowerCase().trim().replace(/[^a-z0-9_]/g, "");
    if (!existing.username) existing.username = defaultUsername;
    if (data.toolName !== undefined) existing.toolName = data.toolName;
    if (data.companyName !== undefined) existing.companyName = data.companyName;
    if (data.avatarUrl !== undefined) existing.avatarUrl = data.avatarUrl;
    if (data.bannerUrl !== undefined) existing.bannerUrl = data.bannerUrl;
    if (data.role) existing.role = data.role;
    if (data.subscriptionStatus) existing.subscriptionStatus = data.subscriptionStatus;
    existing.updatedAt = now;
    saveProfiles(profiles);
    return existing;
  }

  const newProfile: DbUserProfile = {
    id: crypto.randomUUID(),
    email: normalized,
    name: data.name || "",
    username: data.username ? data.username.toLowerCase().trim().replace(/[^a-z0-9_]/g, "") : defaultUsername,
    role: data.role || "member",
    subscriptionStatus: data.subscriptionStatus || "none",
    subscriptionId: null,
    priceId: null,
    toolName: data.toolName || null,
    companyName: data.companyName || null,
    avatarUrl: data.avatarUrl || null,
    bannerUrl: data.bannerUrl || null,
    createdAt: now,
    updatedAt: now,
  };
  profiles.push(newProfile);
  saveProfiles(profiles);
  return newProfile;
}

export async function getUserProfile(email: string): Promise<DbUserProfile | null> {
  const normalized = email.toLowerCase().trim();
  const useDb = await checkDbConnection();

  if (useDb) {
    try {
      const rows = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.email, normalized))
        .limit(1);
      if (rows.length > 0) return mapDbUserProfile(rows[0]!);
    } catch (err) {
      console.error("DB getUserProfile failed, falling back to JSON", err);
    }
  }

  const profiles = loadProfiles();
  return profiles.find((p) => p.email.toLowerCase() === normalized) || null;
}

export async function getAllUserProfiles(): Promise<DbUserProfile[]> {
  const useDb = await checkDbConnection();
  if (useDb) {
    try {
      const rows = await db.select().from(userProfiles).orderBy(desc(userProfiles.createdAt));
      return rows.map(mapDbUserProfile);
    } catch (err) {
      console.error("DB getAllUserProfiles failed, falling back to JSON", err);
    }
  }
  return loadProfiles();
}

export async function updateUserSubscription(email: string, data: {
  subscriptionStatus: "active" | "trialing" | "past_due" | "canceled" | "none";
  subscriptionId?: string;
  priceId?: string;
  role?: "member" | "partner";
}): Promise<DbUserProfile | null> {
  const normalized = email.toLowerCase().trim();
  const useDb = await checkDbConnection();
  const subscriptionStatus =
    data.subscriptionStatus === "trialing" ? "trialing" : data.subscriptionStatus;

  if (useDb) {
    try {
      const existing = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.email, normalized))
        .limit(1);

      if (existing.length > 0) {
        const updated = await db
          .update(userProfiles)
          .set({
            subscriptionStatus,
            ...(data.subscriptionId ? { subscriptionId: data.subscriptionId } : {}),
            ...(data.priceId ? { priceId: data.priceId } : {}),
            ...(data.role ? { role: data.role } : {}),
            updatedAt: new Date(),
          })
          .where(eq(userProfiles.email, normalized))
          .returning();
        return mapDbUserProfile(updated[0]!);
      }

      const inserted = await db
        .insert(userProfiles)
        .values({
          email: normalized,
          name: "",
          role: data.role || "member",
          subscriptionStatus,
          subscriptionId: data.subscriptionId || null,
          priceId: data.priceId || null,
        })
        .returning();
      return mapDbUserProfile(inserted[0]!);
    } catch (err) {
      console.error("DB updateUserSubscription failed, falling back to JSON", err);
    }
  }

  const profiles = loadProfiles();
  const idx = profiles.findIndex((p) => p.email.toLowerCase() === normalized);
  const now = new Date().toISOString();

  if (idx < 0) {
    const newProfile: DbUserProfile = {
      id: crypto.randomUUID(),
      email: normalized,
      name: "",
      role: data.role || "member",
      subscriptionStatus,
      subscriptionId: data.subscriptionId || null,
      priceId: data.priceId || null,
      toolName: null,
      companyName: null,
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
    };
    profiles.push(newProfile);
    saveProfiles(profiles);
    return newProfile;
  }

  const profile = profiles[idx];
  profile.subscriptionStatus = subscriptionStatus;
  if (data.subscriptionId) profile.subscriptionId = data.subscriptionId;
  if (data.priceId) profile.priceId = data.priceId;
  if (data.role) profile.role = data.role;
  profile.updatedAt = now;
  saveProfiles(profiles);
  return profile;
}

// ───────────────────────────────────────────────────────────────────
// TOOL ANALYTICS — impression/click tracking
// ───────────────────────────────────────────────────────────────────

const ANALYTICS_FILE = path.join(DATA_DIR, "tool-analytics.json");
const FOUNDER_FUNNEL_FILE = path.join(DATA_DIR, "founder-funnel.json");

export type FounderFunnelEvent =
  | "page_view"
  | "analysis_started"
  | "analysis_completed"
  | "analysis_fallback"
  | "analysis_failed"
  | "manual_entry_started"
  | "review_confirmed"
  | "package_selected"
  | "free_submission_started"
  | "free_submission_completed"
  | "free_submission_failed"
  | "checkout_started"
  | "checkout_completed"
  | "checkout_cancelled"
  | "checkout_failed";

export type FounderFunnelTier = "free" | "fast_track" | "spotlight";

interface FounderFunnelRecord {
  sessionId: string;
  event: FounderFunnelEvent;
  tier: FounderFunnelTier | null;
  createdAt: string;
}

const FOUNDER_FUNNEL_RETENTION_DAYS = 90;

export async function trackFounderFunnelEvent(data: {
  sessionId: string;
  event: FounderFunnelEvent;
  tier?: FounderFunnelTier;
}): Promise<void> {
  const now = new Date();
  const retentionCutoff = now.getTime() - FOUNDER_FUNNEL_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const records = readJson<FounderFunnelRecord>(FOUNDER_FUNNEL_FILE).filter(
    (record) => Date.parse(record.createdAt) >= retentionCutoff,
  );
  const tier = data.tier || null;

  if (records.some((record) =>
    record.sessionId === data.sessionId &&
    record.event === data.event &&
    record.tier === tier
  )) {
    return;
  }

  records.push({
    sessionId: data.sessionId,
    event: data.event,
    tier,
    createdAt: now.toISOString(),
  });
  writeJson(FOUNDER_FUNNEL_FILE, records);
}

export async function getFounderFunnelAnalytics(days = 30): Promise<{
  periodDays: number;
  totals: Record<FounderFunnelEvent, number>;
  packageSelections: Record<FounderFunnelTier, number>;
  paidCheckoutConversionRate: number;
  pageToPaidConversionRate: number;
}> {
  const safeDays = Math.min(Math.max(Math.floor(days), 1), FOUNDER_FUNNEL_RETENTION_DAYS);
  const cutoff = Date.now() - safeDays * 24 * 60 * 60 * 1000;
  const records = readJson<FounderFunnelRecord>(FOUNDER_FUNNEL_FILE).filter(
    (record) => Date.parse(record.createdAt) >= cutoff,
  );
  const totals: Record<FounderFunnelEvent, number> = {
    page_view: 0,
    analysis_started: 0,
    analysis_completed: 0,
    analysis_fallback: 0,
    analysis_failed: 0,
    manual_entry_started: 0,
    review_confirmed: 0,
    package_selected: 0,
    free_submission_started: 0,
    free_submission_completed: 0,
    free_submission_failed: 0,
    checkout_started: 0,
    checkout_completed: 0,
    checkout_cancelled: 0,
    checkout_failed: 0,
  };
  const packageSelections: Record<FounderFunnelTier, number> = {
    free: 0,
    fast_track: 0,
    spotlight: 0,
  };

  for (const record of records) {
    totals[record.event] += 1;
    if (record.event === "package_selected" && record.tier) {
      packageSelections[record.tier] += 1;
    }
  }

  const rate = (numerator: number, denominator: number) =>
    denominator ? Math.round((numerator / denominator) * 10000) / 100 : 0;

  return {
    periodDays: safeDays,
    totals,
    packageSelections,
    paidCheckoutConversionRate: rate(totals.checkout_completed, totals.checkout_started),
    pageToPaidConversionRate: rate(totals.checkout_completed, totals.page_view),
  };
}

export interface DbToolAnalytic {
  id: string;
  toolName: string;
  eventType: "impression" | "click" | "external_click";
  eventDate: string; // YYYY-MM-DD
  count: number;
  source: string | null;
}

function loadAnalytics(): DbToolAnalytic[] { return readJson<DbToolAnalytic>(ANALYTICS_FILE); }
function saveAnalytics(data: DbToolAnalytic[]): void { writeJson(ANALYTICS_FILE, data); }

export async function trackToolEvent(data: {
  toolName: string;
  eventType: "impression" | "click" | "external_click";
  source?: string;
}): Promise<void> {
  const analytics = loadAnalytics();
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const normalizedTool = data.toolName.toLowerCase().trim();

  const existingIdx = analytics.findIndex(
    (a) =>
      a.toolName === normalizedTool &&
      a.eventType === data.eventType &&
      a.eventDate === today &&
      (a.source || null) === (data.source || null)
  );

  if (existingIdx >= 0) {
    analytics[existingIdx].count += 1;
  } else {
    analytics.push({
      id: crypto.randomUUID(),
      toolName: normalizedTool,
      eventType: data.eventType,
      eventDate: today,
      count: 1,
      source: data.source || null,
    });
  }

  saveAnalytics(analytics);
}

export async function getToolAnalytics(toolName: string, days: number = 30): Promise<{
  totalImpressions: number;
  totalClicks: number;
  totalExternalClicks: number;
  ctr: number;
  dailyData: Array<{ date: string; impressions: number; clicks: number; externalClicks: number }>;
}> {
  const analytics = loadAnalytics();
  const normalizedTool = toolName.toLowerCase().trim();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const filtered = analytics.filter(
    (a) => a.toolName === normalizedTool && a.eventDate >= cutoffStr
  );

  let totalImpressions = 0;
  let totalClicks = 0;
  let totalExternalClicks = 0;
  const dailyMap = new Map<string, { impressions: number; clicks: number; externalClicks: number }>();

  // Pre-fill all dates in the range
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    dailyMap.set(dateStr, { impressions: 0, clicks: 0, externalClicks: 0 });
  }

  for (const record of filtered) {
    const day = dailyMap.get(record.eventDate) || { impressions: 0, clicks: 0, externalClicks: 0 };
    switch (record.eventType) {
      case "impression":
        day.impressions += record.count;
        totalImpressions += record.count;
        break;
      case "click":
        day.clicks += record.count;
        totalClicks += record.count;
        break;
      case "external_click":
        day.externalClicks += record.count;
        totalExternalClicks += record.count;
        break;
    }
    dailyMap.set(record.eventDate, day);
  }

  const dailyData = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const ctr = totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0;

  return { totalImpressions, totalClicks, totalExternalClicks, ctr, dailyData };
}

export async function getPlatformAnalytics(): Promise<{
  totalImpressions: number;
  totalClicks: number;
  totalExternalClicks: number;
  topTools: Array<{ toolName: string; impressions: number; clicks: number }>;
}> {
  const analytics = loadAnalytics();
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalExternalClicks = 0;
  const toolMap = new Map<string, { impressions: number; clicks: number }>();

  for (const record of analytics) {
    const tool = toolMap.get(record.toolName) || { impressions: 0, clicks: 0 };
    switch (record.eventType) {
      case "impression":
        tool.impressions += record.count;
        totalImpressions += record.count;
        break;
      case "click":
        tool.clicks += record.count;
        totalClicks += record.count;
        break;
      case "external_click":
        totalExternalClicks += record.count;
        break;
    }
    toolMap.set(record.toolName, tool);
  }

  const topTools = Array.from(toolMap.entries())
    .map(([toolName, data]) => ({ toolName, ...data }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20);

  return { totalImpressions, totalClicks, totalExternalClicks, topTools };
}

// ───────────────────────────────────────────────────────────────────
// CREATOR APPLICATIONS (YouTube Creator Program)
// ───────────────────────────────────────────────────────────────────

const CREATORS_FILE = path.join(DATA_DIR, "creator-applications.json");

export interface DbCreatorApplication {
  id: string;
  channelName: string;
  videoUrl: string;
  toolName: string;
  email: string;
  status: "pending" | "approved" | "rejected";
  adminNotes: string | null;
  createdAt: string;
}

function loadCreators(): DbCreatorApplication[] { return readJson<DbCreatorApplication>(CREATORS_FILE); }
function saveCreators(data: DbCreatorApplication[]): void { writeJson(CREATORS_FILE, data); }

export async function addCreatorApplication(data: {
  channelName: string;
  videoUrl: string;
  toolName: string;
  email: string;
}): Promise<{ success: boolean; alreadyExists: boolean; message: string }> {
  const creators = loadCreators();
  const normalizedEmail = data.email.toLowerCase().trim();
  const normalizedVideoUrl = data.videoUrl.trim();

  const duplicate = creators.find(
    (c) => c.email.toLowerCase() === normalizedEmail && c.videoUrl === normalizedVideoUrl
  );

  if (duplicate) {
    return {
      success: true,
      alreadyExists: true,
      message: "We already have this video submission. Our team will review it within 48 hours.",
    };
  }

  creators.push({
    id: crypto.randomUUID(),
    channelName: data.channelName.trim(),
    videoUrl: normalizedVideoUrl,
    toolName: data.toolName.trim(),
    email: normalizedEmail,
    status: "pending",
    adminNotes: null,
    createdAt: new Date().toISOString(),
  });
  saveCreators(creators);

  return {
    success: true,
    alreadyExists: false,
    message: "Video submitted! Our editorial team will review and feature it within 48 hours.",
  };
}

export async function getCreatorApplications(): Promise<DbCreatorApplication[]> {
  return [...loadCreators()].reverse();
}

export async function getApprovedVideosForTool(toolName: string): Promise<DbCreatorApplication[]> {
  const creators = loadCreators();
  const normalized = toolName.toLowerCase().trim();
  return creators.filter(
    (c) => c.toolName.toLowerCase().trim() === normalized && c.status === "approved"
  );
}

export async function updateCreatorApplicationStatus(
  id: string,
  status: "pending" | "approved" | "rejected",
  adminNotes?: string
): Promise<DbCreatorApplication | null> {
  const creators = loadCreators();
  const app = creators.find((c) => c.id === id);
  if (!app) return null;
  app.status = status;
  if (adminNotes !== undefined) app.adminNotes = adminNotes;
  saveCreators(creators);
  return app;
}

export async function deleteCreatorApplication(id: string): Promise<boolean> {
  const creators = loadCreators();
  const next = creators.filter((c) => c.id !== id);
  if (next.length === creators.length) return false;
  saveCreators(next);
  return true;
}

// ───────────────────────────────────────────────────────────────────
// MEMBER GUIDES (gated content)
// ───────────────────────────────────────────────────────────────────

const GUIDES_FILE = path.join(DATA_DIR, "member-guides.json");

export interface DbMemberGuide {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  coverImage: string | null;
  readingTime: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

function loadGuides(): DbMemberGuide[] { return readJson<DbMemberGuide>(GUIDES_FILE); }
function saveGuides(data: DbMemberGuide[]): void { writeJson(GUIDES_FILE, data); }

const DEFAULT_STARTER_GUIDES: DbMemberGuide[] = [
  {
    id: "guide-1",
    title: "Mastering Cursor AI & V0: Build & Deploy Fullstack Web Apps in 2 Hours",
    slug: "cursor-v0-fullstack-guide",
    excerpt: "Step-by-step blueprint leveraging Cursor composer and V0 to prototype, build, and ship production Next.js apps seamlessly.",
    category: "workflow",
    content: `# Mastering Cursor AI & V0: Build & Deploy Fullstack Web Apps in 2 Hours\n\nBuilding modern fullstack web applications used to require days of manual boilerplate setup. By pairing **V0 by Vercel** for instant UI component generation with **Cursor AI** for deep backend and logic composition, you can accelerate your development velocity by 10x.\n\n---\n\n## The 4-Step Production Workflow\n\n### Step 1: Rapid UI Prototyping in V0\n1. Navigate to \`v0.dev\` and describe your high-level component tree.\n2. Example prompt: *"Create a responsive dark-mode dashboard for tracking AI subscriptions with glassmorphic cards and interactive Recharts graphs."*\n3. Copy the generated React Tailwind code directly into your repository.\n\n### Step 2: Codebase Context Setup in Cursor\n1. Open Cursor and index your workspace (\`Ctrl + K\` or \`Cmd + K\`).\n2. Add your database schema definitions to \`.cursorrules\` so Cursor understands your data models.\n\n### Step 3: API & Database Integration\n1. Highlight your V0 component and prompt Cursor Composer (\`Cmd + I\`):\n   > *"Connect this component to our Express API endpoint \`/api/user/profile\` using TanStack Query."*\n2. Verify state management and error boundary fallbacks.\n\n### Step 4: One-Click Vercel Deployment\nDeploy your application to production and set up your environment variables.`,
    coverImage: null,
    readingTime: 8,
    published: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "guide-2",
    title: "The Ultimate Prompt Engineering Matrix for Complex Reasoning & Coding",
    slug: "prompt-engineering-matrix-2026",
    excerpt: "Battle-tested prompt structures using XML tags, chain-of-thought verification, and negative constraints for Claude 3.5 & GPT-4o.",
    category: "prompt-engineering",
    content: `# The Ultimate Prompt Engineering Matrix (2026 Edition)\n\nGetting consistent, deterministic outputs from Large Language Models requires systematic prompt structuring rather than conversational guesswork.\n\n---\n\n## 1. The XML Tag Isolation Pattern\n\nWhen supplying multiple context sources (documents, code snippets, rules), isolate them using XML tags:\n\n\`\`\`xml\n<system_rules>\n- You are a senior security engineer.\n- Never output raw SQL without parameterized inputs.\n</system_rules>\n\n<user_input>\nFind all users registered last week.\n</user_input>\n\`\`\`\n\n---\n\n## 2. Chain-of-Thought (CoT) Verification\n\nForce the model to think before delivering code.`,
    coverImage: null,
    readingTime: 6,
    published: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "guide-3",
    title: "Automated Lead Gen & Outreach Machine with Make.com & OpenAI",
    slug: "automated-lead-gen-machine",
    excerpt: "How to capture, enrich, qualify, and draft personalized outreach emails automatically with zero human effort.",
    category: "automation",
    content: `# Automated Lead Gen & Outreach Machine with Make.com & OpenAI\n\nAutomating cold outreach requires personalization at scale. Here is how top B2B growth teams automate lead enrichment.\n\n---\n\n## Architecture Stack\n- **Trigger**: Webhook capture from landing page form\n- **Enrichment**: Clearbit / Apollo API\n- **AI Personalization**: OpenAI GPT-4o mini\n- **Fulfillment**: Brevo / Resend API`,
    coverImage: null,
    readingTime: 7,
    published: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

export async function getPublishedGuides(): Promise<Omit<DbMemberGuide, "content">[]> {
  let guides = loadGuides().filter((g) => g.published);
  if (guides.length === 0) {
    guides = DEFAULT_STARTER_GUIDES;
    saveGuides(DEFAULT_STARTER_GUIDES);
  }
  return guides.map(({ content, ...rest }) => rest);
}

export async function getGuideBySlug(slug: string, includeContent: boolean = false): Promise<DbMemberGuide | Omit<DbMemberGuide, "content"> | null> {
  let guides = loadGuides();
  if (guides.length === 0) {
    guides = DEFAULT_STARTER_GUIDES;
    saveGuides(DEFAULT_STARTER_GUIDES);
  }
  const guide = guides.find((g) => g.slug === slug && g.published);
  if (!guide) return null;
  if (!includeContent) {
    const { content, ...rest } = guide;
    return rest;
  }
  return guide;
}

export async function getAllGuides(): Promise<DbMemberGuide[]> {
  return loadGuides();
}

export async function upsertGuide(data: {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  coverImage?: string;
  readingTime?: number;
  published?: boolean;
}): Promise<DbMemberGuide> {
  const guides = loadGuides();
  const now = new Date().toISOString();

  if (data.id) {
    const idx = guides.findIndex((g) => g.id === data.id);
    if (idx >= 0) {
      guides[idx] = {
        ...guides[idx],
        ...data,
        coverImage: data.coverImage || guides[idx].coverImage,
        readingTime: data.readingTime ?? guides[idx].readingTime,
        published: data.published ?? guides[idx].published,
        updatedAt: now,
      };
      saveGuides(guides);
      return guides[idx];
    }
  }

  const newGuide: DbMemberGuide = {
    id: data.id || crypto.randomUUID(),
    title: data.title,
    slug: data.slug,
    excerpt: data.excerpt,
    content: data.content,
    category: data.category,
    coverImage: data.coverImage || null,
    readingTime: data.readingTime || 5,
    published: data.published ?? false,
    createdAt: now,
    updatedAt: now,
  };
  guides.push(newGuide);
  saveGuides(guides);
  return newGuide;
}

// ───────────────────────────────────────────────────────────────────
// SOCIAL POSTS (partner updates with verified badges)
// ───────────────────────────────────────────────────────────────────

const SOCIAL_FILE = path.join(DATA_DIR, "social-posts.json");
const SOCIAL_LIKES_FILE = path.join(DATA_DIR, "social-likes.json");

export interface DbSocialReply {
  id: string;
  authorEmail: string;
  authorName: string;
  authorRole: "partner" | "member" | "admin";
  authorAvatar?: string | null;
  authorHandle?: string;
  content: string;
  createdAt: string;
  likes: number;
}

export interface DbSocialPost {
  id: string;
  authorEmail: string;
  authorName: string;
  authorHandle?: string;
  authorRole: "partner" | "member" | "admin";
  authorAvatar?: string | null;
  authorBadge?: "verified_partner" | "official_tool" | "pro_member" | "founder";
  toolTag?: string | null; // e.g. "Cursor", "Midjourney", "ChatGPT", "v0", "Agents"
  postType?: "official_release" | "showcase" | "question" | "feedback" | "discussion";
  content: string;
  imageUrl: string | null;
  mediaUrl?: string | null;
  likes: number;
  reposts?: string[]; // user emails who reposted
  replies?: DbSocialReply[];
  shares?: number;
  /** Tool Signals fields. Kept optional so historical records remain readable. */
  visibility?: "public" | "followers";
  tags?: string[];
  toolName?: string | null;
  toolId?: string | null;
  companyName?: string | null;
  toolIconUrl?: string | null;
  authorTitle?: string | null;
  status: "published" | "pending" | "removed";
  createdAt: string;
}

const OFFICIAL_SEED_POSTS: DbSocialPost[] = [
  {
    id: "post-cursor-045",
    authorEmail: "updates@cursor.com",
    authorName: "Cursor Official",
    authorHandle: "@cursor_ai",
    authorRole: "partner",
    authorAvatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80",
    authorBadge: "official_tool",
    toolTag: "Cursor",
    postType: "official_release",
    content: "Cursor v0.45 is officially live!\n\n• Next-generation Agent Mode: Multi-file composer with automated terminal command validation.\n• 3x faster indexing for large monorepos.\n• Live diff previews directly in the editor before applying changes.\n\nLet us know your feedback below",
    imageUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&auto=format&fit=crop&q=80",
    mediaUrl: null,
    likes: 48,
    reposts: ["issam@aitoolshubi.com", "builder@agency.dev"],
    replies: [
      {
        id: "rep-1",
        authorEmail: "issam@aitoolshubi.com",
        authorName: "Issam Djebabra",
        authorHandle: "@issam",
        authorRole: "admin",
        authorAvatar: null,
        content: "The multi-file agent execution is phenomenal. Massive speedup for fullstack building!",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        likes: 12,
      },
    ],
    shares: 19,
    status: "published",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "post-v0-mobile",
    authorEmail: "team@v0.dev",
    authorName: "v0 by Vercel",
    authorHandle: "@v0",
    authorRole: "partner",
    authorAvatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80",
    authorBadge: "official_tool",
    toolTag: "v0",
    postType: "official_release",
    content: "We just shipped native mobile canvas previews & Figma token sync in v0!\n\nYou can now prototype responsive iOS & Android interfaces with standard Tailwind classes and export directly to React Native or Next.js.",
    imageUrl: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=1200&auto=format&fit=crop&q=80",
    mediaUrl: null,
    likes: 35,
    reposts: ["design_lead@studio.io"],
    replies: [],
    shares: 8,
    status: "published",
    createdAt: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: "post-midjourney-v7",
    authorEmail: "news@midjourney.com",
    authorName: "Midjourney",
    authorHandle: "@midjourney",
    authorRole: "partner",
    authorAvatar: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=120&auto=format&fit=crop&q=80",
    authorBadge: "official_tool",
    toolTag: "Midjourney",
    postType: "official_release",
    content: "Midjourney V7 parameter alpha is now rolling out to active subscribers!\n\nFeatures ultra-consistent character rendering across multiple scenes, 4K native generation, and prompt text adherence improvements.",
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80",
    mediaUrl: null,
    likes: 89,
    reposts: ["artist@metaverse.com", "creator@youtube.com"],
    replies: [],
    shares: 27,
    status: "published",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

const TOOL_SIGNALS_WELCOME_POST: DbSocialPost = {
  id: "aitoolshubi-tool-signals-welcome",
  authorEmail: "team@aitoolshubi.com",
  authorName: "AItools Hubi Team",
  authorRole: "admin",
  authorBadge: "verified_partner",
  authorTitle: "Product team",
  toolId: "aitoolshubi",
  toolName: "AItools Hubi",
  companyName: "AItools Hubi",
  toolTag: "AItools Hubi",
  postType: "official_release",
  visibility: "public",
  tags: ["Welcome", "Tool Signals"],
  content: "Welcome to Tool Signals — the calm place to follow the AI tools you use. Follow a tool to receive its product updates in your Hubi inbox, and choose Helpful, Interested, or Needs clarification to give the team useful feedback. No popularity counters. Just clear updates between tools and the people who rely on them.",
  imageUrl: null,
  mediaUrl: null,
  likes: 0,
  reposts: [],
  replies: [],
  shares: 0,
  status: "published",
  createdAt: new Date().toISOString(),
};

function loadSocialPosts(): DbSocialPost[] {
  const existing = readJson<DbSocialPost>(SOCIAL_FILE);
  // Remove only the original demo fixtures and the two one-character test posts
  // seen in the old feed. Real authored updates are left untouched.
  const demoIds = new Set(OFFICIAL_SEED_POSTS.map((post) => post.id));
  const posts = existing.filter((post) => !demoIds.has(post.id) && !["wow", "h"].includes(post.content?.trim().toLowerCase()));
  if (!posts.some((post) => post.id === TOOL_SIGNALS_WELCOME_POST.id)) posts.unshift(TOOL_SIGNALS_WELCOME_POST);
  if (posts.length !== existing.length || !existing.some((post) => post.id === TOOL_SIGNALS_WELCOME_POST.id)) saveSocialPosts(posts);
  return posts;
}

function saveSocialPosts(data: DbSocialPost[]): void { writeJson(SOCIAL_FILE, data); }
function loadSocialLikes(): Record<string, string[]> {
  const entries = readJson<{ id: string; emails: string[] }>(SOCIAL_LIKES_FILE);
  return Object.fromEntries(entries.filter((entry) => entry?.id && Array.isArray(entry.emails)).map((entry) => [entry.id, entry.emails]));
}
function saveSocialLikes(data: Record<string, string[]>): void {
  writeJson(SOCIAL_LIKES_FILE, Object.entries(data).map(([id, emails]) => ({ id, emails })));
}

export async function createSocialPost(data: {
  authorEmail: string;
  authorName: string;
  authorHandle?: string;
  authorRole: "partner" | "member" | "admin";
  authorAvatar?: string;
  authorBadge?: "verified_partner" | "official_tool" | "pro_member" | "founder";
  toolTag?: string;
  toolId?: string;
  toolName?: string;
  companyName?: string;
  toolIconUrl?: string;
  authorTitle?: string;
  visibility?: "public" | "followers";
  tags?: string[];
  postType?: "official_release" | "showcase" | "question" | "feedback" | "discussion";
  content: string;
  imageUrl?: string;
  mediaUrl?: string;
}): Promise<DbSocialPost> {
  const posts = loadSocialPosts();
  const newPost: DbSocialPost = {
    id: crypto.randomUUID(),
    authorEmail: data.authorEmail.toLowerCase().trim(),
    authorName: data.authorName.trim(),
    authorHandle: data.authorHandle || `@${data.authorEmail.split("@")[0]}`,
    authorRole: data.authorRole,
    authorAvatar: data.authorAvatar || null,
    authorBadge:
      data.authorBadge ||
      (data.authorRole === "admin"
        ? "verified_partner"
        : data.authorRole === "partner"
        ? "founder"
        : "pro_member"),
    toolTag: data.toolTag || "General",
    toolId: data.toolId || null,
    toolName: data.toolName || data.toolTag || null,
    companyName: data.companyName || null,
    toolIconUrl: data.toolIconUrl || null,
    authorTitle: data.authorTitle || null,
    visibility: data.visibility || "public",
    tags: Array.isArray(data.tags) ? data.tags.slice(0, 5) : [],
    postType: data.postType || (data.authorRole === "partner" ? "official_release" : "discussion"),
    content: data.content.trim().substring(0, 1000),
    imageUrl: data.imageUrl || null,
    mediaUrl: data.mediaUrl || null,
    likes: 0,
    reposts: [],
    replies: [],
    shares: 0,
    // Partners & Admins publish directly; members published for dynamic community interaction
    status: "published",
    createdAt: new Date().toISOString(),
  };
  posts.unshift(newPost);
  saveSocialPosts(posts);
  return newPost;
}

export async function getPublishedSocialPosts(limit: number = 50, toolTag?: string): Promise<DbSocialPost[]> {
  let posts = loadSocialPosts().filter((p) => p.status === "published");
  if (toolTag && toolTag !== "All" && toolTag !== "all") {
    if (toolTag === "official" || toolTag === "Official") {
      posts = posts.filter((p) => p.postType === "official_release" || p.authorBadge === "official_tool" || p.authorBadge === "verified_partner");
    } else {
      posts = posts.filter((p) => p.toolTag?.toLowerCase() === toolTag.toLowerCase());
    }
  }
  return posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export async function getAllSocialPosts(): Promise<DbSocialPost[]> {
  return [...loadSocialPosts()].reverse();
}

export async function updateSocialPostStatus(id: string, status: "published" | "pending" | "removed"): Promise<DbSocialPost | null> {
  const posts = loadSocialPosts();
  const post = posts.find((p) => p.id === id);
  if (!post) return null;
  post.status = status;
  saveSocialPosts(posts);
  return post;
}

export async function likeSocialPost(id: string, email: string): Promise<{ post: DbSocialPost; liked: boolean } | null> {
  const posts = loadSocialPosts();
  const post = posts.find((p) => p.id === id);
  if (!post) return null;
  const likes = loadSocialLikes();
  const normalizedEmail = email.toLowerCase().trim();
  const previous = Array.isArray(likes[id]) ? likes[id] : [];
  const alreadyLiked = previous.includes(normalizedEmail);
  likes[id] = alreadyLiked ? previous.filter((item) => item !== normalizedEmail) : [...previous, normalizedEmail];
  post.likes = Math.max(0, post.likes + (alreadyLiked ? -1 : 1));
  saveSocialPosts(posts);
  saveSocialLikes(likes);
  return { post, liked: !alreadyLiked };
}

export async function repostSocialPost(id: string, email: string): Promise<{ post: DbSocialPost; reposted: boolean } | null> {
  const posts = loadSocialPosts();
  const post = posts.find((p) => p.id === id);
  if (!post) return null;
  const normalizedEmail = email.toLowerCase().trim();
  post.reposts = post.reposts || [];
  const alreadyReposted = post.reposts.includes(normalizedEmail);
  if (alreadyReposted) {
    post.reposts = post.reposts.filter((e) => e !== normalizedEmail);
  } else {
    post.reposts.push(normalizedEmail);
  }
  saveSocialPosts(posts);
  return { post, reposted: !alreadyReposted };
}

export async function addSocialReply(
  postId: string,
  replyData: {
    authorEmail: string;
    authorName: string;
    authorHandle?: string;
    authorRole: "partner" | "member" | "admin";
    authorAvatar?: string | null;
    content: string;
  }
): Promise<{ post: DbSocialPost; reply: DbSocialReply } | null> {
  const posts = loadSocialPosts();
  const post = posts.find((p) => p.id === postId);
  if (!post) return null;
  post.replies = post.replies || [];
  const reply: DbSocialReply = {
    id: crypto.randomUUID(),
    authorEmail: replyData.authorEmail.toLowerCase().trim(),
    authorName: replyData.authorName.trim(),
    authorHandle: replyData.authorHandle || `@${replyData.authorEmail.split("@")[0]}`,
    authorRole: replyData.authorRole,
    authorAvatar: replyData.authorAvatar || null,
    content: replyData.content.trim(),
    createdAt: new Date().toISOString(),
    likes: 0,
  };
  post.replies.push(reply);
  saveSocialPosts(posts);
  return { post, reply };
}

export async function incrementPostShares(id: string): Promise<number | null> {
  const posts = loadSocialPosts();
  const post = posts.find((p) => p.id === id);
  if (!post) return null;
  post.shares = (post.shares || 0) + 1;
  saveSocialPosts(posts);
  return post.shares;
}

export async function deleteSocialPost(id: string): Promise<boolean> {
  const posts = loadSocialPosts();
  const next = posts.filter((p) => p.id !== id);
  if (next.length === posts.length) return false;
  saveSocialPosts(next);
  const likes = loadSocialLikes();
  if (likes[id]) {
    delete likes[id];
    saveSocialLikes(likes);
  }
  return true;
}

// ───────────────────────────────────────────────────────────────────
// TOOL SIGNALS — follower relationships, considered reactions and inbox alerts
// ───────────────────────────────────────────────────────────────────

const TOOL_FOLLOWS_FILE = path.join(DATA_DIR, "tool-follows.json");
const SOCIAL_REACTIONS_FILE = path.join(DATA_DIR, "social-reactions.json");
const SOCIAL_NOTIFICATIONS_FILE = path.join(DATA_DIR, "social-notifications.json");

export type ToolSignalReaction = "helpful" | "interested" | "clarify";

export interface DbToolFollow {
  id: string;
  email: string;
  toolId: string;
  toolName: string;
  companyName?: string | null;
  toolIconUrl?: string | null;
  emailNotifications: boolean;
  createdAt: string;
}

export interface DbToolSignalNotification {
  id: string;
  email: string;
  type: "tool_update" | "system";
  title: string;
  body: string;
  link: string;
  toolName?: string | null;
  readAt?: string | null;
  createdAt: string;
}

function loadToolFollows(): DbToolFollow[] { return readJson<DbToolFollow>(TOOL_FOLLOWS_FILE); }
function saveToolFollows(follows: DbToolFollow[]): void { writeJson(TOOL_FOLLOWS_FILE, follows); }
function loadSocialReactions(): Record<string, Record<string, ToolSignalReaction>> {
  const entries = readJson<{ postId: string; reactions: Record<string, ToolSignalReaction> }>(SOCIAL_REACTIONS_FILE);
  return Object.fromEntries(entries.filter((entry) => entry?.postId && entry.reactions).map((entry) => [entry.postId, entry.reactions]));
}
function saveSocialReactions(reactions: Record<string, Record<string, ToolSignalReaction>>): void {
  writeJson(SOCIAL_REACTIONS_FILE, Object.entries(reactions).map(([postId, postReactions]) => ({ postId, reactions: postReactions })));
}
function loadSocialNotifications(): DbToolSignalNotification[] { return readJson<DbToolSignalNotification>(SOCIAL_NOTIFICATIONS_FILE); }
function saveSocialNotifications(notifications: DbToolSignalNotification[]): void { writeJson(SOCIAL_NOTIFICATIONS_FILE, notifications); }

export async function getToolFollows(email: string): Promise<DbToolFollow[]> {
  const normalizedEmail = email.toLowerCase().trim();
  const allFollows = loadToolFollows().filter((follow) => follow.email === normalizedEmail);
  // Deduplicate follows by toolId / normalized toolName
  const unique = new Map<string, DbToolFollow>();
  for (const follow of allFollows) {
    const key = (follow.toolId || follow.toolName).toLowerCase().trim();
    if (!unique.has(key)) {
      unique.set(key, follow);
    }
  }
  return [...unique.values()];
}

export async function toggleToolFollow(data: Omit<DbToolFollow, "id" | "createdAt">): Promise<{ following: boolean; follow: DbToolFollow | null }> {
  const follows = loadToolFollows();
  const email = data.email.toLowerCase().trim();
  const toolId = data.toolId.trim();
  const normalizedToolName = data.toolName.toLowerCase().trim();

  // Find existing by email AND (toolId OR normalized toolName)
  const existingIndex = follows.findIndex(
    (follow) =>
      follow.email === email &&
      (follow.toolId.toLowerCase() === toolId.toLowerCase() ||
        follow.toolName.toLowerCase() === normalizedToolName ||
        (follow.id && follow.id === toolId))
  );

  if (existingIndex >= 0) {
    follows.splice(existingIndex, 1);
    saveToolFollows(follows);
    return { following: false, follow: null };
  }

  const follow: DbToolFollow = {
    id: crypto.randomUUID(),
    email,
    toolId,
    toolName: data.toolName.trim(),
    companyName: data.companyName || null,
    toolIconUrl: data.toolIconUrl || null,
    emailNotifications: data.emailNotifications !== false,
    createdAt: new Date().toISOString(),
  };
  follows.push(follow);
  saveToolFollows(follows);
  return { following: true, follow };
}

export async function getToolFollowers(toolId: string): Promise<DbToolFollow[]> {
  return loadToolFollows().filter((follow) => follow.toolId === toolId);
}

export async function toggleToolSignalReaction(postId: string, email: string, reaction: ToolSignalReaction): Promise<ToolSignalReaction | null> {
  const reactions = loadSocialReactions();
  const key = email.toLowerCase().trim();
  const postReactions = reactions[postId] || {};
  const next = postReactions[key] === reaction ? null : reaction;
  if (next) postReactions[key] = next;
  else delete postReactions[key];
  reactions[postId] = postReactions;
  saveSocialReactions(reactions);
  return next;
}

export async function getToolSignalReaction(postId: string, email?: string): Promise<ToolSignalReaction | null> {
  if (!email) return null;
  return loadSocialReactions()[postId]?.[email.toLowerCase().trim()] || null;
}

export async function createToolSignalNotifications(data: Omit<DbToolSignalNotification, "id" | "email" | "createdAt" | "readAt">, recipients: string[]): Promise<void> {
  const notifications = loadSocialNotifications();
  const uniqueRecipients = [...new Set(recipients.map((email) => email.toLowerCase().trim()).filter(Boolean))];
  for (const email of uniqueRecipients) {
    notifications.unshift({ id: crypto.randomUUID(), email, ...data, readAt: null, createdAt: new Date().toISOString() });
  }
  saveSocialNotifications(notifications.slice(0, 5_000));
}

export async function getToolSignalNotifications(email: string, limit = 30): Promise<DbToolSignalNotification[]> {
  const normalizedEmail = email.toLowerCase().trim();
  return loadSocialNotifications().filter((notification) => notification.email === normalizedEmail).slice(0, limit);
}

export async function markToolSignalNotificationsRead(email: string, ids?: string[]): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const selected = ids ? new Set(ids) : null;
  const notifications = loadSocialNotifications();
  let changed = false;
  for (const notification of notifications) {
    if (notification.email === normalizedEmail && !notification.readAt && (!selected || selected.has(notification.id))) {
      notification.readAt = new Date().toISOString();
      changed = true;
    }
  }
  if (changed) saveSocialNotifications(notifications);
}

// ───────────────────────────────────────────────────────────────────
// TESTIMONIALS (editorially reviewed before public display)
// ───────────────────────────────────────────────────────────────────

const TESTIMONIALS_FILE = path.join(DATA_DIR, "testimonials.json");

export interface DbTestimonial {
  id: string;
  email: string;
  name: string;
  role: string;
  rating: number;
  text: string;
  status: "pending" | "published" | "rejected";
  createdAt: string;
}

function loadTestimonials(): DbTestimonial[] { return readJson<DbTestimonial>(TESTIMONIALS_FILE); }
function saveTestimonials(data: DbTestimonial[]): void { writeJson(TESTIMONIALS_FILE, data); }

export async function addTestimonial(data: Omit<DbTestimonial, "id" | "status" | "createdAt">): Promise<DbTestimonial> {
  const testimonials = loadTestimonials();
  const normalizedEmail = data.email.toLowerCase().trim();
  const duplicate = testimonials.find((item) => item.email === normalizedEmail && item.text.toLowerCase() === data.text.trim().toLowerCase());
  if (duplicate) return duplicate;

  const testimonial: DbTestimonial = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    name: data.name.trim(),
    role: data.role.trim(),
    rating: data.rating,
    text: data.text.trim(),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  testimonials.push(testimonial);
  saveTestimonials(testimonials);
  return testimonial;
}

export async function getPublishedTestimonials(limit = 6): Promise<Omit<DbTestimonial, "email" | "status">[]> {
  return loadTestimonials()
    .filter((item) => item.status === "published")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map(({ email: _email, status: _status, ...testimonial }) => testimonial);
}

export async function getAllTestimonials(): Promise<DbTestimonial[]> { return [...loadTestimonials()].reverse(); }

export async function updateTestimonialStatus(id: string, status: DbTestimonial["status"]): Promise<DbTestimonial | null> {
  const testimonials = loadTestimonials();
  const testimonial = testimonials.find((item) => item.id === id);
  if (!testimonial) return null;
  testimonial.status = status;
  saveTestimonials(testimonials);
  return testimonial;
}

// ── Secure User Account Authentication & Password Management ──

export interface DbUserAccount {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  name: string;
  username: string;
  role: "member" | "partner" | "creator" | "admin";
  createdAt: string;
  updatedAt: string;
}

const USER_ACCOUNTS_FILE = path.join(DATA_DIR, "user-accounts.json");

function loadUserAccounts(): DbUserAccount[] {
  return readJson<DbUserAccount>(USER_ACCOUNTS_FILE);
}

function saveUserAccounts(accounts: DbUserAccount[]): void {
  writeJson(USER_ACCOUNTS_FILE, accounts);
}

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const calculated = crypto.scryptSync(password, salt, 64).toString("hex");
    const calcBuf = Buffer.from(calculated, "hex");
    const hashBuf = Buffer.from(hash, "hex");
    if (calcBuf.length !== hashBuf.length) return false;
    return crypto.timingSafeEqual(calcBuf, hashBuf);
  } catch {
    return false;
  }
}

export async function createUserAccount(data: {
  email: string;
  password: string;
  name?: string;
  username?: string;
  role?: "member" | "partner" | "creator" | "admin";
}): Promise<Omit<DbUserAccount, "passwordHash" | "passwordSalt">> {
  const normalizedEmail = data.email.toLowerCase().trim();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new Error("A valid email address is required.");
  }
  if (!data.password || data.password.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }

  const accounts = loadUserAccounts();
  const existing = accounts.find((a) => a.email.toLowerCase() === normalizedEmail);
  if (existing) {
    throw new Error("An account with this email address already exists.");
  }

  // Determine username
  let finalUsername = (data.username || normalizedEmail.split("@")[0] || "user")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, "");

  // Check username uniqueness
  const existingUsername = accounts.find((a) => a.username.toLowerCase() === finalUsername);
  if (existingUsername) {
    // If auto-generated, make it unique
    if (!data.username) {
      finalUsername = `${finalUsername}_${Math.floor(100 + Math.random() * 900)}`;
    } else {
      throw new Error(`Username @${finalUsername} is already taken.`);
    }
  }

  const { hash, salt } = hashPassword(data.password);
  const now = new Date().toISOString();
  const newAccount: DbUserAccount = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    passwordHash: hash,
    passwordSalt: salt,
    name: (data.name || normalizedEmail.split("@")[0] || "AI Builder").trim(),
    username: finalUsername,
    role: data.role || (normalizedEmail === "issam@aitoolshubi.com" || normalizedEmail === "djebabraissam8@gmail.com" ? "admin" : "member"),
    createdAt: now,
    updatedAt: now,
  };

  accounts.push(newAccount);
  saveUserAccounts(accounts);

  // Sync with profile
  await upsertUserProfile({
    email: normalizedEmail,
    name: newAccount.name,
    username: newAccount.username,
    role: newAccount.role,
    subscriptionStatus: "none",
  });

  const { passwordHash: _h, passwordSalt: _s, ...safeUser } = newAccount;
  return safeUser;
}

export async function authenticateUser(
  emailOrUsername: string,
  password: string
): Promise<Omit<DbUserAccount, "passwordHash" | "passwordSalt"> | null> {
  if (!emailOrUsername || !password) return null;

  const normalized = emailOrUsername.toLowerCase().trim();
  const accounts = loadUserAccounts();

  const account = accounts.find(
    (a) => a.email.toLowerCase() === normalized || a.username.toLowerCase() === normalized.replace(/^@/, "")
  );

  if (!account) {
    // If account not created yet, check if profile exists
    return null;
  }

  const isValid = verifyPassword(password, account.passwordHash, account.passwordSalt);
  if (!isValid) {
    return null;
  }

  const { passwordHash: _h, passwordSalt: _s, ...safeUser } = account;
  return safeUser;
}

export async function resetUserPassword(email: string, newPassword: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  if (!newPassword || newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }

  const accounts = loadUserAccounts();
  const idx = accounts.findIndex((a) => a.email.toLowerCase() === normalizedEmail);
  const { hash, salt } = hashPassword(newPassword);
  const now = new Date().toISOString();

  if (idx >= 0) {
    accounts[idx]!.passwordHash = hash;
    accounts[idx]!.passwordSalt = salt;
    accounts[idx]!.updatedAt = now;
    saveUserAccounts(accounts);
    return true;
  }

  // If user profile existed prior to account password table
  const profile = await getUserProfile(normalizedEmail);
  const username = profile?.username || normalizedEmail.split("@")[0] || "user";
  const name = profile?.name || normalizedEmail.split("@")[0] || "AI Builder";

  const newAccount: DbUserAccount = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    passwordHash: hash,
    passwordSalt: salt,
    name,
    username,
    role: profile?.role || "member",
    createdAt: now,
    updatedAt: now,
  };

  accounts.push(newAccount);
  saveUserAccounts(accounts);
  return true;
}

export async function getUserAccountByEmail(email: string): Promise<Omit<DbUserAccount, "passwordHash" | "passwordSalt"> | null> {
  const normalized = email.toLowerCase().trim();
  const accounts = loadUserAccounts();
  const account = accounts.find((a) => a.email.toLowerCase() === normalized);
  if (!account) return null;
  const { passwordHash: _h, passwordSalt: _s, ...safeUser } = account;
  return safeUser;
}

// ─── ENTERPRISE INQUIRIES & LEAD GATEWAY ──────────────────────────────
export interface EnterpriseInquiry {
  id: string;
  toolName: string;
  buyerName: string;
  buyerEmail: string;
  companyName: string;
  teamSize: string;
  budget?: string;
  useCase?: string;
  createdAt: string;
}

const ENTERPRISE_INQUIRIES_FILE = path.join(DATA_DIR, "enterprise-inquiries.json");

function loadEnterpriseInquiries(): EnterpriseInquiry[] {
  try {
    if (!fs.existsSync(ENTERPRISE_INQUIRIES_FILE)) {
      return [];
    }
    const data = fs.readFileSync(ENTERPRISE_INQUIRIES_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveEnterpriseInquiries(inquiries: EnterpriseInquiry[]): void {
  try {
    ensureDataDir();
    fs.writeFileSync(ENTERPRISE_INQUIRIES_FILE, JSON.stringify(inquiries, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to save enterprise inquiries:", err);
  }
}

export async function addEnterpriseInquiry(inquiry: Omit<EnterpriseInquiry, "id" | "createdAt">): Promise<EnterpriseInquiry> {
  const inquiries = loadEnterpriseInquiries();
  const record: EnterpriseInquiry = {
    ...inquiry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  inquiries.unshift(record);
  saveEnterpriseInquiries(inquiries);
  return record;
}

export async function getEnterpriseInquiriesByTool(toolName: string): Promise<EnterpriseInquiry[]> {
  const norm = toolName.toLowerCase().trim();
  const inquiries = loadEnterpriseInquiries();
  return inquiries.filter((i) => i.toolName.toLowerCase().trim() === norm);
}

export async function getAllEnterpriseInquiryCounts(): Promise<Record<string, number>> {
  const inquiries = loadEnterpriseInquiries();
  const counts: Record<string, number> = {};
  for (const item of inquiries) {
    const key = item.toolName.toLowerCase().trim();
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}
