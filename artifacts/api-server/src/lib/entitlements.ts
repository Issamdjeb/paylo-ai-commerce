import {
  getUserProfile,
  getPartnershipApplications,
  type DbApplication,
} from "./db-fallback.js";

export type PartnerTier = "free" | "featured" | "premium";

export interface AccountEntitlements {
  community: {
    active: boolean;
    subscription: {
      status: string;
      tier: string;
    } | null;
  };
  partner: {
    active: boolean;
    tier: PartnerTier | null;
    tools: Array<{
      id: string;
      toolName: string;
      companyName: string;
      website: string;
      description: string;
      logoUrl?: string | null;
      tier: PartnerTier;
      status: string;
    }>;
  };
  billing: {
    activeSubscriptions: Array<{
      subscriptionId: string;
      status: string;
      priceId: string;
    }>;
  };
}

export async function getAccountEntitlements(email: string): Promise<AccountEntitlements> {
  const normalizedEmail = email.toLowerCase().trim();
  const profile = await getUserProfile(normalizedEmail);
  const applications = await getPartnershipApplications();

  const userApplications = applications.filter(
    (app) => app.email.toLowerCase().trim() === normalizedEmail
  );

  const isAdmin =
    profile?.role === "admin" ||
    normalizedEmail === "issam@aitoolshubi.com" ||
    normalizedEmail === "djebabraissam8@gmail.com";

  // Partner detection
  const isPartnerUser =
    profile?.role === "partner" ||
    userApplications.some((app) => app.status === "approved" || app.status === "pending" || app.tier !== "free");

  let highestTier: PartnerTier = "free";
  const priceId = (profile?.priceId || "").toLowerCase();
  
  if (
    priceId.includes("premium") ||
    userApplications.some((app) => app.tier === "premium")
  ) {
    highestTier = "premium";
  } else if (
    priceId.includes("featured") ||
    userApplications.some((app) => app.tier === "featured") ||
    isPartnerUser
  ) {
    highestTier = "featured";
  } else {
    highestTier = "free";
  }

  const isPartnerActive = isAdmin || isPartnerUser;

  // Community membership should only be active for Pro Members (role="member" or priceId="community"), not just partner listings
  const isCommunityActive =
    isAdmin ||
    ((profile?.role === "member" || priceId.includes("community") || priceId.includes("pro")) &&
      profile?.subscriptionStatus === "active");

  const partnerTools = userApplications.map((app) => {
    const logoLine = (app.description || "").split("\n").find((line) => line.startsWith("Logo: "));
    return {
      id: app.id,
      toolName: app.toolName,
      companyName: app.companyName,
      website: app.website,
      description: app.description,
      logoUrl: logoLine?.replace("Logo: ", "").trim() || null,
      tier: (app.tier === "premium" || app.tier === "featured" ? app.tier : "free") as PartnerTier,
      status: app.status || "approved",
    };
  });

  if (isPartnerActive && partnerTools.length === 0) {
    partnerTools.push({
      id: "partner-tool-1",
      toolName: profile?.toolName || "My AI Tool",
      companyName: profile?.companyName || "Founder Studio",
      website: "https://aitoolshubi.com",
      description: "Official Verified AI Tool listed on AItools Hubi directory.",
      logoUrl: null,
      tier: highestTier,
      status: "approved",
    });
  }

  return {
    community: {
      active: isCommunityActive,
      subscription: isCommunityActive
        ? {
            status: "active",
            tier: "pro",
          }
        : null,
    },
    partner: {
      active: isPartnerActive,
      tier: isPartnerActive ? highestTier : null,
      tools: partnerTools,
    },
    billing: {
      activeSubscriptions: profile?.subscriptionId
        ? [
            {
              subscriptionId: profile.subscriptionId,
              status: profile.subscriptionStatus || "active",
              priceId: profile.priceId || "default",
            },
          ]
        : [],
    },
  };
}

export function hasCommunityEntitlement(entitlements: AccountEntitlements): boolean {
  return Boolean(entitlements?.community?.active);
}

export function hasPartnerEntitlement(entitlements: AccountEntitlements): boolean {
  return Boolean(entitlements?.partner?.active);
}
