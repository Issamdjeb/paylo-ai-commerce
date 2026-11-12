import { supabase, SUPABASE_CONFIGURED } from "./supabase";

/** Authenticated fetch — attaches Supabase JWT or local session token and identity headers. */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  let tokenAttached = false;

  if (SUPABASE_CONFIGURED) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
        tokenAttached = true;
      }
    } catch {
      // ignore
    }
  }

  // Attach session token or user identity from local session store
  try {
    const localSession = localStorage.getItem("local_user_session");
    if (localSession) {
      const parsed = JSON.parse(localSession) as { email?: string; token?: string; id?: string };
      if (parsed.token && !tokenAttached) {
        headers.set("Authorization", `Bearer ${parsed.token}`);
        tokenAttached = true;
      }
      if (parsed.email) {
        const email = parsed.email.toLowerCase().trim();
        headers.set("X-User-Email", email);
        headers.set("X-Dev-Email", email);
      }
    }
  } catch {
    // ignore
  }

  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
  const target = apiBase && input.startsWith("/api/") ? `${apiBase}${input}` : input;
  return fetch(target, { ...init, headers });
}
