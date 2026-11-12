import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { supabase, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { apiFetch } from "@/lib/api-client";
import { migrateGuestLibraryToUser } from "@/lib/user-library";
import type { User, Session } from "@supabase/supabase-js";

export interface UserProfile {
  id?: string;
  email: string;
  name: string;
  username?: string | null;
  role: "free" | "member" | "partner" | "creator" | "admin";
  subscriptionStatus: "active" | "trialing" | "past_due" | "canceled" | "none";
  subscriptionId?: string | null;
  priceId?: string | null;
  toolName?: string | null;
  companyName?: string | null;
  jobRole?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  entitlements?: {
    community: { active: boolean; subscription: { status: string; scheduledChangeAction?: string | null; scheduledChangeAt?: string | null } | null };
    partner: { active: boolean; tier: "free" | "featured" | "premium" | null; tools: Array<{ id: string; toolName: string; companyName: string; website: string; description: string; logoUrl?: string | null; tier: "free" | "featured" | "premium"; status?: string }> };
    billing: { activeSubscriptions: Array<{ subscriptionId: string; status: string; priceId: string }> };
  };
}

export type WorkspaceMode = "community" | "partner" | "account" | "admin";

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isProMember: boolean;
  isPartner: boolean;
  isAdmin: boolean;
  isFree: boolean;
  partnerTier: "premium" | "featured" | "free" | "none";
  availableWorkspaces: readonly ("community" | "partner" | "admin")[];
  activeWorkspaceMode: WorkspaceMode;
  switchWorkspaceMode: (mode: WorkspaceMode) => void;
  switchAccountRole: (role: "free" | "member" | "partner" | "admin") => void;
  signInWithGoogle: () => Promise<any>;
  signInWithGitHub: () => Promise<any>;
  signInWithEmail: (email: string, password: string) => Promise<any>;
  signUpWithEmail: (email: string, password: string, name?: string, username?: string, role?: "member" | "partner") => Promise<any>;
  initiateSignUp: (email: string, password: string, name?: string, username?: string, role?: "member" | "partner") => Promise<any>;
  verifySignUpOtp: (email: string, code?: string, token?: string) => Promise<any>;
  resendSignUpOtp: (email: string) => Promise<any>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function postAuthRedirectUrl(): string {
  const requestedPath = new URLSearchParams(window.location.search).get("redirect");
  const safePath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
    ? requestedPath
    : "/dashboard";
  return `${window.location.origin}${safePath}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const hasLocal = Boolean(localStorage.getItem("local_user_session"));
      const hasSb = Object.keys(localStorage).some((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
      return hasLocal || hasSb;
    } catch {
      return false;
    }
  });

  const [localSession, setLocalSession] = useState<any>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("local_user_session") || "{}");
    } catch {
      return {};
    }
  });

  const loadProfile = useCallback(async () => {
    try {
      const res = await apiFetch("/api/user/me");
      if (res.status === 401) {
        setProfile(null);
        return;
      }
      const data = await res.json();
      if (data.profile) {
        setProfile({
          ...data.profile,
          entitlements: data.entitlements,
          subscriptionStatus: data.isPaidSubscriber
            ? data.profile.subscriptionStatus === "trialing"
              ? "trialing"
              : "active"
            : data.profile.subscriptionStatus || "none",
        });
      }
    } catch (err) {
      console.error("Failed to load user profile", err);
    }
  }, []);

  const restoreLocalSession = useCallback(async (): Promise<boolean> => {
    try {
      const savedLocalUser = localStorage.getItem("local_user_session");
      if (!savedLocalUser) return false;

      const parsed = JSON.parse(savedLocalUser);
      if (!parsed?.email) return false;

      const fakeUser = {
        id: parsed.id || `user-${Date.now()}`,
        email: parsed.email,
        user_metadata: { name: parsed.name || parsed.email.split("@")[0] },
        app_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      } as User;
      setUser(fakeUser);
      setLocalSession(parsed);
      migrateGuestLibraryToUser(parsed.email);
      void loadProfile();
      return true;
    } catch {
      return false;
    }
  }, [loadProfile]);

  useEffect(() => {
    const initAuth = async () => {
      if (SUPABASE_CONFIGURED) {
        try {
          // Safeguard: don't let getSession hang more than 1000ms for visitors
          const getSessionPromise = supabase.auth.getSession().catch(() => ({ data: { session: null } }));
          const timeoutPromise = new Promise<{ data: { session: any } }>((resolve) =>
            setTimeout(() => resolve({ data: { session: null } }), 1000)
          );
          const { data: { session: currentSession } } = await Promise.race([getSessionPromise, timeoutPromise]);

          if (currentSession?.user) {
            setSession(currentSession);
            setUser(currentSession.user);
            if (currentSession.user.email) migrateGuestLibraryToUser(currentSession.user.email);
            void loadProfile();
          } else {
            await restoreLocalSession();
          }
        } catch {
          await restoreLocalSession();
        } finally {
          setLoading(false);
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
          if (nextSession?.user) {
            setSession(nextSession);
            setUser(nextSession.user);
            if (nextSession.user.email) migrateGuestLibraryToUser(nextSession.user.email);
            void loadProfile();
          } else {
            const restored = await restoreLocalSession();
            if (!restored) {
              setSession(null);
              setUser(null);
              setProfile(null);
            }
          }
          setLoading(false);
        });

        return () => subscription.unsubscribe();
      }

      // Local fallback session
      await restoreLocalSession();
      setLoading(false);
      return undefined;
    };

    void initAuth();
  }, [loadProfile, restoreLocalSession]);

  useEffect(() => {
    const handleAuthEvent = () => {
      try {
        const updated = JSON.parse(localStorage.getItem("local_user_session") || "{}");
        setLocalSession(updated);
        loadProfile();
      } catch {}
    };

    window.addEventListener("auth_state_changed", handleAuthEvent);
    window.addEventListener("storage", handleAuthEvent);
    return () => {
      window.removeEventListener("auth_state_changed", handleAuthEvent);
      window.removeEventListener("storage", handleAuthEvent);
    };
  }, [loadProfile]);

  const isLocalPartner = localSession?.role === "partner" || localSession?.planTier === "featured" || localSession?.planTier === "premium";
  const isLocalPro = (localSession?.role === "member" || localSession?.role === "pro" || localSession?.planTier === "community") && localSession?.subscriptionStatus === "active";
  const isLocalAdmin = localSession?.role === "admin";
  // Real entitlements always come from the API in production. Local browser
  // state is usable only for an intentionally enabled development preview.
  const useDevelopmentEntitlements = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_AUTH === "true";

  const isAdmin = useMemo(() => {
    return Boolean(
      profile?.role === "admin" ||
      (useDevelopmentEntitlements && isLocalAdmin)
    );
  }, [profile?.role, isLocalAdmin, useDevelopmentEntitlements]);

  const partnerTier: "premium" | "featured" | "free" | "none" = useMemo(() => {
    if (isAdmin) return "premium";
    const serverTier = profile?.entitlements?.partner?.tier;
    const localTier = useDevelopmentEntitlements ? (localSession?.planTier || "").toLowerCase() : "";
    let activeSubTier = "";
    if (useDevelopmentEntitlements && typeof window !== "undefined" && user?.email) {
      try {
        const sub = JSON.parse(localStorage.getItem(`aitoolshubi_active_subscription_${user.email}`) || "{}");
        activeSubTier = (sub?.tier || "").toLowerCase();
      } catch {}
    }

    if (
      serverTier === "premium" ||
      localTier.includes("premium") ||
      activeSubTier.includes("premium")
    ) {
      return "premium";
    }

    if (
      serverTier === "featured" ||
      localTier.includes("featured") ||
      activeSubTier.includes("featured")
    ) {
      return "featured";
    }

    if (
      profile?.entitlements?.partner?.active ||
      profile?.role === "partner" ||
      Boolean(profile?.toolName) ||
      Boolean((profile?.entitlements?.partner?.tools?.length ?? 0) > 0) ||
      (useDevelopmentEntitlements && isLocalPartner)
    ) {
      return "free";
    }

    return "none";
  }, [isAdmin, profile?.entitlements?.partner?.tier, profile?.entitlements?.partner?.active, profile?.entitlements?.partner?.tools, profile?.role, profile?.toolName, localSession, user?.email, isLocalPartner, useDevelopmentEntitlements]);

  const isPartner = useMemo(() => {
    return Boolean(
      partnerTier === "premium" ||
      partnerTier === "featured" ||
      partnerTier === "free" ||
      profile?.entitlements?.partner?.active ||
      profile?.role === "partner" ||
      Boolean(profile?.toolName) ||
      Boolean((profile?.entitlements?.partner?.tools?.length ?? 0) > 0) ||
      (useDevelopmentEntitlements && isLocalPartner) ||
      isAdmin
    );
  }, [partnerTier, profile?.entitlements?.partner?.active, profile?.entitlements?.partner?.tools, profile?.role, profile?.toolName, isLocalPartner, isAdmin, useDevelopmentEntitlements]);

  const isProMember = useMemo(() => {
    if (isAdmin) return true;
    const isPartnerTierPaid = partnerTier === "premium" || partnerTier === "featured";

    // A partner subscription ($19 or $49) is a founder tier, not a Pro Community Membership ($6/mo)
    return Boolean(
      (profile?.entitlements?.community?.active || (useDevelopmentEntitlements && isLocalPro)) &&
      !isPartnerTierPaid
    );
  }, [isAdmin, profile?.entitlements?.community?.active, profile?.role, isLocalPro, partnerTier, localSession?.role, useDevelopmentEntitlements]);

  const isFree = !isProMember && !isPartner && !isAdmin;

  const availableWorkspaces = useMemo(() => [
    ...(user ? (["community"] as const) : []),
    ...(isPartner ? (["partner"] as const) : []),
    ...(isAdmin ? (["admin"] as const) : []),
  ], [user, isPartner, isAdmin]);

  const [activeWorkspaceMode, setActiveWorkspaceModeState] = useState<WorkspaceMode>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlMode = params.get("mode");
      if (urlMode === "partner") return "partner";
      if (urlMode === "personal" || urlMode === "community") return "community";

      const saved = localStorage.getItem("aitoolshubi_workspace_mode");
      if (saved === "partner" || saved === "community" || saved === "account" || saved === "admin") {
        return saved;
      }
    }
    return "community";
  });

  const switchWorkspaceMode = useCallback((mode: WorkspaceMode) => {
    if (mode === "partner" && !isPartner) return;
    if (mode === "admin" && !isAdmin) return;
    setActiveWorkspaceModeState(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("aitoolshubi_workspace_mode", mode);
      if (user?.email) {
        localStorage.setItem(`workspace_mode_${user.email}`, mode);
      }
      // Update URL search param smoothly without full page refresh
      const url = new URL(window.location.href);
      if (mode === "partner") {
        url.searchParams.set("mode", "partner");
      } else {
        url.searchParams.delete("mode");
      }
      window.history.replaceState({}, "", url.toString());
      window.dispatchEvent(new CustomEvent("workspace_mode_changed", { detail: { mode } }));
    }
  }, [user?.email, isPartner, isAdmin]);

  // Synchronize when URL specifies mode=partner and user profile finishes loading
  useEffect(() => {
    if (typeof window === "undefined" || loading) return;
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get("mode");
    if (urlMode === "partner" && isPartner && activeWorkspaceMode !== "partner") {
      setActiveWorkspaceModeState("partner");
    }
  }, [loading, isPartner, activeWorkspaceMode]);

  // A stale saved preference must never open an unavailable workspace, but NEVER downgrade while loading
  useEffect(() => {
    if (loading) return;
    if (activeWorkspaceMode === "partner" && !isPartner) {
      switchWorkspaceMode("community");
    }
    if (activeWorkspaceMode === "admin" && !isAdmin) {
      switchWorkspaceMode("community");
    }
  }, [loading, activeWorkspaceMode, isPartner, isAdmin, switchWorkspaceMode]);

  const switchAccountRole = useCallback((role: "free" | "member" | "partner" | "admin") => {
    if (!import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_AUTH !== "true") return;
    if (!user?.email) return;
    const isSub = role === "member" || role === "partner" || role === "admin";
    const updated = {
      ...localSession,
      email: user.email,
      role: role === "free" ? "free" : role,
      subscriptionStatus: isSub ? "active" : "none",
    };
    localStorage.setItem("local_user_session", JSON.stringify(updated));
    setLocalSession(updated);

    const isPart = role === "partner";
    const isPro = (role === "member" || role === "admin") && isSub;

    setProfile({
      id: profile?.id || user.id || "local-user",
      email: user.email,
      name: profile?.name || user.email.split("@")[0],
      username: profile?.username || user.email.split("@")[0],
      role,
      subscriptionStatus: isSub ? "active" : "none",
      entitlements: {
        community: { active: isPro, subscription: null },
        partner: { active: isPart, tier: isPart ? "featured" : "free", tools: [] },
        billing: { activeSubscriptions: [] },
      },
    });

    const newMode: WorkspaceMode = role === "partner" ? "partner" : "community";
    switchWorkspaceMode(newMode);

    window.dispatchEvent(new Event("auth_state_changed"));

    apiFetch("/api/user/profile", {
      method: "POST",
      body: JSON.stringify({ role, subscriptionStatus: isSub ? "active" : "none" }),
    }).catch(() => {});
  }, [user?.email, user?.id, localSession, profile, switchWorkspaceMode]);

  const signInWithGoogle = useCallback(() => {
    if (SUPABASE_CONFIGURED) {
      return supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: postAuthRedirectUrl() },
      });
    }
    const demoEmail = "demo.google@user.com";
    const demoUser = { id: "google-123", email: demoEmail, name: "Google User" };
    localStorage.setItem("local_user_session", JSON.stringify(demoUser));
    window.location.href = postAuthRedirectUrl();
    return Promise.resolve({ data: { user: demoUser as any, session: null }, error: null });
  }, []);

  const signInWithGitHub = useCallback(() => {
    if (SUPABASE_CONFIGURED) {
      return supabase.auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo: postAuthRedirectUrl() },
      });
    }
    const demoEmail = "demo.github@user.com";
    const demoUser = { id: "github-123", email: demoEmail, name: "GitHub User" };
    localStorage.setItem("local_user_session", JSON.stringify(demoUser));
    window.location.href = postAuthRedirectUrl();
    return Promise.resolve({ data: { user: demoUser as any, session: null }, error: null });
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const trimmedEmail = email.trim().toLowerCase();

    // 1. Try AItools Hubi backend authentication endpoint
    try {
      const res = await apiFetch("/api/auth/signin", {
        method: "POST",
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
      
      if (res.ok) {
        const data = await res.json();
        const authenticatedUser = {
          id: data.user.id,
          email: data.user.email,
          user_metadata: { name: data.user.name },
          app_metadata: {},
          aud: "authenticated",
          created_at: new Date().toISOString(),
        } as User;

        localStorage.setItem("local_user_session", JSON.stringify({
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          username: data.user.username,
          role: data.user.role,
          token: data.token,
        }));

        setUser(authenticatedUser);
        if (data.profile) {
          setProfile(data.profile);
        } else {
          await loadProfile();
        }

        if (SUPABASE_CONFIGURED) {
          supabase.auth.signInWithPassword({ email: trimmedEmail, password })
            .then((r) => { if (r.data?.session) setSession(r.data.session); })
            .catch(() => {});
        }

        return { data: { user: authenticatedUser, session: null }, error: null };
      } else {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          return { data: { user: null, session: null }, error: { message: "Incorrect password. Please try again or reset your password." } };
        }
        if (res.status === 404) {
          return { data: { user: null, session: null }, error: { message: "This account is not registered. Please create an account first." } };
        }
      }
    } catch {
      // Backend cold-starting or offline — proceed to direct Supabase / local fallback
    }

    // 2. Direct Supabase fallback if backend proxy is sleeping
    if (SUPABASE_CONFIGURED) {
      try {
        const { data: suData, error: suError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (!suError && suData?.user) {
          const authUser = {
            id: suData.user.id,
            email: suData.user.email || trimmedEmail,
            user_metadata: suData.user.user_metadata || {},
            app_metadata: {},
            aud: "authenticated",
            created_at: new Date().toISOString(),
          } as User;

          localStorage.setItem("local_user_session", JSON.stringify({
            id: authUser.id,
            email: authUser.email,
            name: authUser.user_metadata?.name || authUser.email?.split("@")[0],
            username: authUser.email?.split("@")[0],
            role: authUser.user_metadata?.role || "member",
            token: `supa_${authUser.id}`,
          }));

          setUser(authUser);
          if (suData.session) setSession(suData.session);
          await loadProfile();
          return { data: { user: authUser, session: suData.session }, error: null };
        }
      } catch {
        // Fall through to local fallback
      }
    }

    // 3. Check saved local session credentials fallback
    try {
      const saved = localStorage.getItem("local_user_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.email?.toLowerCase() === trimmedEmail) {
          const authUser = {
            id: parsed.id || `local_${Date.now()}`,
            email: trimmedEmail,
            user_metadata: { name: parsed.name },
            app_metadata: {},
            aud: "authenticated",
            created_at: new Date().toISOString(),
          } as User;
          setUser(authUser);
          return { data: { user: authUser, session: null }, error: null };
        }
      }
    } catch {
      // ignore
    }

    return { data: { user: null, session: null }, error: { message: "Unable to sign in. Please check your credentials or create a new account." } };
  }, [loadProfile]);

  const initiateSignUp = useCallback(async (
    email: string,
    password: string,
    name?: string,
    username?: string,
    role?: "member" | "partner"
  ) => {
    const trimmedEmail = email.trim().toLowerCase();

    // 1. Try AItools Hubi backend initiate endpoint
    try {
      const res = await apiFetch("/api/auth/signup/initiate", {
        method: "POST",
        body: JSON.stringify({ email: trimmedEmail, password, name, username, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        return { data, error: null };
      }
      if (res.status === 409) {
        return { data: null, error: { message: "This email is already registered. Please sign in instead." } };
      }
      if (res.status === 400 && data.error) {
        return { data: null, error: { message: data.error } };
      }
    } catch {
      // Backend is cold-starting or offline — proceed to direct Supabase / instant fallback
    }

    return {
      data: null,
      error: { message: "Sign-up service is temporarily unavailable. Please try again in a moment." },
    };
  }, []);

  const verifySignUpOtp = useCallback(async (email: string, code?: string, token?: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    try {
      const res = await apiFetch("/api/auth/signup/verify", {
        method: "POST",
        body: JSON.stringify({ email: trimmedEmail, code: code?.trim(), token: token?.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { data: null, error: { message: data.error || "Verification failed. Please check your 6-digit code." } };
      }

      const authenticatedUser = {
        id: data.user.id,
        email: data.user.email,
        user_metadata: { name: data.user.name },
        app_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      } as User;

      localStorage.setItem("local_user_session", JSON.stringify({
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        username: data.user.username,
        role: data.user.role,
        token: data.token,
      }));

      setUser(authenticatedUser);
      if (data.profile) {
        setProfile(data.profile);
      } else {
        await loadProfile();
      }

      if (SUPABASE_CONFIGURED) {
        supabase.auth.getSession().then(({ data: sessData }) => {
          if (sessData?.session) setSession(sessData.session);
        }).catch(() => {});
      }

      return { data: { user: authenticatedUser, profile: data.profile, token: data.token }, error: null };
    } catch {
      return { data: null, error: { message: "Verification failed. Please check your code or request a new one." } };
    }
  }, [loadProfile]);

  const resendSignUpOtp = useCallback(async (email: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    try {
      const res = await apiFetch("/api/auth/signup/resend", {
        method: "POST",
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { data: null, error: { message: data.error || "Failed to resend code." } };
      }
      return { data, error: null };
    } catch {
      return { data: null, error: { message: "Server is waking up. Please wait a few seconds and try again." } };
    }
  }, []);

  const signUpWithEmail = useCallback(async (
    email: string,
    password: string,
    name?: string,
    username?: string,
    role?: "member" | "partner"
  ) => {
    return initiateSignUp(email, password, name, username, role);
  }, [initiateSignUp]);

  const signOut = useCallback(async () => {
    localStorage.removeItem("local_user_session");
    localStorage.removeItem("aitoolshubi_workspace_mode");
    setUser(null);
    setSession(null);
    setProfile(null);
    if (SUPABASE_CONFIGURED) {
      await supabase.auth.signOut();
    }
    window.location.href = "/";
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    session,
    profile,
    loading,
    isProMember,
    isPartner,
    isAdmin,
    isFree,
    partnerTier,
    availableWorkspaces,
    activeWorkspaceMode,
    switchWorkspaceMode,
    switchAccountRole,
    signInWithGoogle,
    signInWithGitHub,
    signInWithEmail,
    signUpWithEmail,
    initiateSignUp,
    verifySignUpOtp,
    resendSignUpOtp,
    signOut,
    refreshProfile: loadProfile,
  }), [
    user,
    session,
    profile,
    loading,
    isProMember,
    isPartner,
    isAdmin,
    isFree,
    partnerTier,
    availableWorkspaces,
    activeWorkspaceMode,
    switchWorkspaceMode,
    switchAccountRole,
    signInWithGoogle,
    signInWithGitHub,
    signInWithEmail,
    signUpWithEmail,
    initiateSignUp,
    verifySignUpOtp,
    resendSignUpOtp,
    signOut,
    loadProfile,
  ]);

  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    // If used outside AuthProvider, provide safe fallback
    return {
      user: null,
      session: null,
      profile: null,
      loading: false,
      isProMember: false,
      isPartner: false,
      isAdmin: false,
      isFree: true,
      partnerTier: "none",
      availableWorkspaces: [],
      activeWorkspaceMode: "community",
      switchWorkspaceMode: () => {},
      switchAccountRole: () => {},
      signInWithGoogle: () => Promise.resolve({ data: null, error: null }),
      signInWithGitHub: () => Promise.resolve({ data: null, error: null }),
      signInWithEmail: () => Promise.resolve({ data: null, error: null }),
      signUpWithEmail: () => Promise.resolve({ data: null, error: null }),
      initiateSignUp: () => Promise.resolve({ data: null, error: null }),
      verifySignUpOtp: () => Promise.resolve({ data: null, error: null }),
      resendSignUpOtp: () => Promise.resolve({ data: null, error: null }),
      signOut: () => Promise.resolve(),
      refreshProfile: () => Promise.resolve(),
    };
  }
  return context;
}
