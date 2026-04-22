import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type { OrganizationMember, Profile } from "@/lib/types/domain";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  memberships: OrganizationMember[];
  activeOrganizationId: string | null;
  setActiveOrganizationId: (id: string) => void;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ACTIVE_ORG_STORAGE_KEY = "multitask.active_organization_id";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<OrganizationMember[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(() =>
    localStorage.getItem(ACTIVE_ORG_STORAGE_KEY)
  );
  const [loading, setLoading] = useState(true);

  const user = session?.user ?? null;

  const loadProfileAndMemberships = async (userId: string) => {
    const [{ data: profileData }, { data: membershipData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("organization_members").select("*").eq("user_id", userId),
    ]);
    setProfile(profileData);
    const members = membershipData ?? [];
    setMemberships(members);

    // If no active org selected but user has memberships, default to first
    if (members.length > 0) {
      setActiveOrgId((current) => {
        if (current && members.some((m) => m.organization_id === current)) {
          return current;
        }
        const next = members[0].organization_id;
        localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, next);
        return next;
      });
    }
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(initialSession);
      if (initialSession?.user) {
        await loadProfileAndMemberships(initialSession.user.id);
      }
      setLoading(false);
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession?.user) {
        await loadProfileAndMemberships(newSession.user.id);
      } else {
        setProfile(null);
        setMemberships([]);
        setActiveOrgId(null);
        localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (!user) return;
    await loadProfileAndMemberships(user.id);
  };

  const setActiveOrganizationId = (id: string) => {
    localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, id);
    setActiveOrgId(id);
  };

  const value: AuthContextValue = {
    session,
    user,
    profile,
    memberships,
    activeOrganizationId: activeOrgId,
    setActiveOrganizationId,
    loading,
    signInWithGoogle,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
