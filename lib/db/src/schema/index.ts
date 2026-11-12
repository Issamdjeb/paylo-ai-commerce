import { pgTable, text, timestamp, uuid, integer, boolean, date, jsonb } from "drizzle-orm/pg-core";

// ─── EXISTING TABLES ────────────────────────────────────────────────

export const communitySignups = pgTable("community_signups", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  plan: text("plan").notNull().default("pro"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type InsertCommunitySignup = typeof communitySignups.$inferInsert;
export type CommunitySignup = typeof communitySignups.$inferSelect;

export const partnershipApplications = pgTable("partnership_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyName: text("company_name").notNull(),
  toolName: text("tool_name").notNull(),
  website: text("website").notNull(),
  email: text("email").notNull(),
  tier: text("tier").notNull().default("featured"),
  description: text("description").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type InsertPartnershipApplication = typeof partnershipApplications.$inferInsert;
export type PartnershipApplication = typeof partnershipApplications.$inferSelect;

// ─── USER PROFILES (extends Supabase Auth) ──────────────────────────

export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  /** Linked Supabase Auth user id */
  supabaseUserId: text("supabase_user_id").unique(),
  name: text("name"),
  /** "member" = community user, "partner" = tool owner, "creator" = YouTube creator, "admin" = admin */
  role: text("role").notNull().default("member"),
  /** "active" | "trialing" | "past_due" | "canceled" | "none" */
  subscriptionStatus: text("subscription_status").notNull().default("none"),
  /** The subscription ID */
  subscriptionId: text("subscription_id"),
  /** The price/plan ID they're subscribed to */
  priceId: text("price_id"),
  /** For partners: the tool name they own */
  toolName: text("tool_name"),
  /** For partners: their company name */
  companyName: text("company_name"),
  /** Avatar URL from OAuth or uploaded */
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type InsertUserProfile = typeof userProfiles.$inferInsert;
export type UserProfile = typeof userProfiles.$inferSelect;

// ─── TOOL ANALYTICS (impressions/clicks per tool per day) ───────────

export const toolAnalytics = pgTable("tool_analytics", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** The tool name (slug-compatible) */
  toolName: text("tool_name").notNull(),
  /** "impression" | "click" | "external_click" */
  eventType: text("event_type").notNull(),
  /** The date of this aggregate record */
  eventDate: date("event_date").notNull(),
  /** Number of events on this date */
  count: integer("count").notNull().default(0),
  /** Optional: referrer or page source */
  source: text("source"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type InsertToolAnalytic = typeof toolAnalytics.$inferInsert;
export type ToolAnalytic = typeof toolAnalytics.$inferSelect;

// ─── CREATOR APPLICATIONS (YouTube Creator Program) ─────────────────

export const creatorApplications = pgTable("creator_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** YouTube channel name */
  channelName: text("channel_name").notNull(),
  /** YouTube video URL */
  videoUrl: text("video_url").notNull(),
  /** The AI tool this video is about */
  toolName: text("tool_name").notNull(),
  /** Contact email */
  email: text("email").notNull(),
  /** "pending" | "approved" | "rejected" */
  status: text("status").notNull().default("pending"),
  /** Admin notes */
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type InsertCreatorApplication = typeof creatorApplications.$inferInsert;
export type CreatorApplication = typeof creatorApplications.$inferSelect;

// ─── MEMBER GUIDES (gated content for paid members) ─────────────────

export const memberGuides = pgTable("member_guides", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  /** Short summary shown to everyone */
  excerpt: text("excerpt").notNull(),
  /** Full markdown content (members-only) */
  content: text("content").notNull(),
  /** Category: "prompt-engineering" | "workflow" | "tool-chain" | "automation" */
  category: text("category").notNull().default("workflow"),
  /** Cover image URL */
  coverImage: text("cover_image"),
  /** Reading time in minutes */
  readingTime: integer("reading_time").notNull().default(5),
  /** Whether this guide is published */
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type InsertMemberGuide = typeof memberGuides.$inferInsert;
export type MemberGuide = typeof memberGuides.$inferSelect;

// ─── SOCIAL POSTS (partner updates with blue checkmarks) ────────────

export const socialPosts = pgTable("social_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Email of the author */
  authorEmail: text("author_email").notNull(),
  /** Display name */
  authorName: text("author_name").notNull(),
  /** "partner" (blue check) | "member" | "admin" (gold check) */
  authorRole: text("author_role").notNull().default("member"),
  /** The post content (plain text, max 500 chars) */
  content: text("content").notNull(),
  /** Optional image URL */
  imageUrl: text("image_url"),
  /** Number of likes */
  likes: integer("likes").notNull().default(0),
  /** "published" | "pending" | "removed" */
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type InsertSocialPost = typeof socialPosts.$inferInsert;
export type SocialPost = typeof socialPosts.$inferSelect;



export const processedWebhooks = pgTable("processed_webhooks", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  processedAt: timestamp("processed_at").notNull().defaultNow(),
});

export type InsertProcessedWebhook = typeof processedWebhooks.$inferInsert;
export type ProcessedWebhook = typeof processedWebhooks.$inferSelect;