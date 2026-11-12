export interface UserLibrary {
  savedToolIds: string[];
  upvotedToolIds: string[];
  recentlyViewedToolIds: string[];
  updatedAt: string;
}

const EMPTY_LIBRARY: UserLibrary = {
  savedToolIds: [],
  upvotedToolIds: [],
  recentlyViewedToolIds: [],
  updatedAt: "",
};

function ownerKey(email?: string | null): string {
  const clean = (email || "").trim().toLowerCase();
  return clean ? encodeURIComponent(clean) : "guest_unauth";
}

function storageKey(email?: string | null): string {
  return `hubi:account_library:${ownerKey(email)}`;
}

function uniqueIds(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(String).filter(Boolean))).slice(0, limit);
}

function parseLibrary(value: string | null): UserLibrary {
  if (!value) return { ...EMPTY_LIBRARY };
  try {
    const parsed = JSON.parse(value) as Partial<UserLibrary>;
    return {
      savedToolIds: uniqueIds(parsed.savedToolIds, 100),
      upvotedToolIds: uniqueIds(parsed.upvotedToolIds, 500),
      recentlyViewedToolIds: uniqueIds(parsed.recentlyViewedToolIds, 16),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return { ...EMPTY_LIBRARY };
  }
}

function readLibrary(email?: string | null): UserLibrary {
  if (typeof window === "undefined") return { ...EMPTY_LIBRARY };
  const key = storageKey(email);
  const current = parseLibrary(localStorage.getItem(key));
  return current;
}

function writeLibrary(email: string | null | undefined, library: UserLibrary): void {
  if (typeof window === "undefined") return;
  const next = { ...library, updatedAt: new Date().toISOString() };
  const key = storageKey(email);
  localStorage.setItem(key, JSON.stringify(next));
  window.dispatchEvent(
    new CustomEvent("hubi-library:update", {
      detail: { email: email || "guest_unauth", library: next },
    })
  );
}

export function getUserLibrary(email?: string | null): UserLibrary {
  return readLibrary(email);
}

export function toggleSavedTool(email: string | null | undefined, toolId: string | number): boolean {
  const library = readLibrary(email);
  const id = String(toolId);
  const isSaved = library.savedToolIds.includes(id);
  writeLibrary(email, {
    ...library,
    savedToolIds: isSaved
      ? library.savedToolIds.filter((item) => item !== id)
      : [id, ...library.savedToolIds].slice(0, 100),
  });
  return !isSaved;
}

export function toggleUpvotedTool(email: string | null | undefined, toolId: string | number): boolean {
  const library = readLibrary(email);
  const id = String(toolId);
  const hasUpvoted = library.upvotedToolIds.includes(id);
  writeLibrary(email, {
    ...library,
    upvotedToolIds: hasUpvoted
      ? library.upvotedToolIds.filter((item) => item !== id)
      : [id, ...library.upvotedToolIds].slice(0, 500),
  });
  return !hasUpvoted;
}

export function recordRecentlyViewedTool(email: string | null | undefined, toolId: string | number): void {
  const library = readLibrary(email);
  const id = String(toolId);
  writeLibrary(email, {
    ...library,
    recentlyViewedToolIds: [id, ...library.recentlyViewedToolIds.filter((item) => item !== id)].slice(0, 16),
  });
}

/**
 * When an unauthenticated visitor who saved tools or stacks finally signs in or creates an account,
 * merge their guest library into their authenticated account profile.
 */
export function migrateGuestLibraryToUser(email: string | null | undefined): void {
  if (!email || typeof window === "undefined") return;
  const guestKey = storageKey(null);
  const guestRaw = localStorage.getItem(guestKey);
  if (!guestRaw) return;

  try {
    const guestLib = parseLibrary(guestRaw);
    if (!guestLib.savedToolIds.length && !guestLib.upvotedToolIds.length && !guestLib.recentlyViewedToolIds.length) {
      return;
    }
    const userLib = readLibrary(email);
    const merged: UserLibrary = {
      savedToolIds: uniqueIds([...guestLib.savedToolIds, ...userLib.savedToolIds], 100),
      upvotedToolIds: uniqueIds([...guestLib.upvotedToolIds, ...userLib.upvotedToolIds], 500),
      recentlyViewedToolIds: uniqueIds([...guestLib.recentlyViewedToolIds, ...userLib.recentlyViewedToolIds], 16),
      updatedAt: new Date().toISOString(),
    };
    writeLibrary(email, merged);
    localStorage.removeItem(guestKey);
  } catch (err) {
    console.error("Failed to migrate guest library to user account:", err);
  }
}
