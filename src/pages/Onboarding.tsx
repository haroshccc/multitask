import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, Users, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

type Mode = "create" | "join";

interface SuggestedOrg {
  id: string;
  name: string;
  suggested_email_domain: string | null;
}

export function Onboarding() {
  const navigate = useNavigate();
  const { session, loading, memberships, refreshProfile, signOut } = useAuth();

  const [mode, setMode] = useState<Mode>("create");

  // create org state
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDomain, setNewDomain] = useState("");

  // join org state
  const [joinOrgId, setJoinOrgId] = useState<string>("");
  const [joinPassword, setJoinPassword] = useState("");
  const [suggested, setSuggested] = useState<SuggestedOrg[]>([]);

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userEmail = session?.user?.email ?? "";

  useEffect(() => {
    if (!userEmail) return;
    supabase
      .rpc("find_organizations_by_email_domain", { p_email: userEmail })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setSuggested(data as SuggestedOrg[]);
          setMode("join");
          setJoinOrgId(data[0].id);
        }
      });
  }, [userEmail]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-ink-400" />
      </div>
    );
  }

  if (!session) return <Navigate to="/" replace />;
  if (memberships.length > 0) return <Navigate to="/app" replace />;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newPassword.length < 4) {
      setError("שם ארגון וסיסמה נדרשים (מינימום 4 תווים)");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("create_organization_with_password", {
      p_name: newName.trim(),
      p_join_password: newPassword,
      p_suggested_email_domain: newDomain.trim() || undefined,
    });
    if (rpcErr) {
      setError("שגיאה ביצירת הארגון: " + rpcErr.message);
      setSubmitting(false);
      return;
    }
    await refreshProfile();
    navigate("/app", { replace: true });
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinOrgId || joinPassword.length < 1) {
      setError("בחרי ארגון והזיני סיסמה");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("join_organization_with_password", {
      p_organization_id: joinOrgId,
      p_join_password: joinPassword,
    });
    if (rpcErr) {
      setError("סיסמה שגויה או ארגון לא נמצא");
      setSubmitting(false);
      return;
    }
    await refreshProfile();
    navigate("/app", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-ink-100 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-ink-900 mb-2">ברוכה הבאה ל-Multitask</h1>
          <p className="text-ink-600">נכנסת כ־{userEmail}. צרי ארגון חדש או הצטרפי לקיים.</p>
        </div>

        {/* Mode switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-ink-100 rounded-2xl mb-6">
          <button
            onClick={() => setMode("create")}
            className={cn(
              "flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all",
              mode === "create" ? "bg-white shadow-soft text-ink-900" : "text-ink-600"
            )}
          >
            <Building2 className="w-4 h-4" />
            ארגון חדש
          </button>
          <button
            onClick={() => setMode("join")}
            className={cn(
              "flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all",
              mode === "join" ? "bg-white shadow-soft text-ink-900" : "text-ink-600"
            )}
          >
            <Users className="w-4 h-4" />
            הצטרפות
          </button>
        </div>

        {suggested.length > 0 && mode === "join" && (
          <div className="bg-primary-50 border border-primary-200 rounded-2xl p-4 mb-6 text-sm text-primary-800">
            זיהינו ארגון אפשרי לפי הדומיין של המייל שלך ✨
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-lift border border-ink-200 p-6">
          {mode === "create" ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <Field label="שם הארגון">
                <input
                  className="field"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="הרוש סטודיו"
                  autoFocus
                />
              </Field>
              <Field label="סיסמת הצטרפות" hint="משתפים רק למי שצריך להצטרף">
                <div className="relative">
                  <input
                    className="field pe-10"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="סיסמה חזקה"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 left-2 flex items-center text-ink-400 hover:text-ink-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>
              <Field label="דומיין מוצע (אופציונלי)" hint="נניח acme.com — נזהה מהצטרפים עם מייל תואם">
                <input
                  className="field"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="acme.com"
                />
              </Field>

              {error && <ErrorBox>{error}</ErrorBox>}

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full"
              >
                {submitting ? "יוצרת..." : "צרי ארגון"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              {suggested.length > 0 ? (
                <Field label="בחרי ארגון">
                  <select
                    className="field"
                    value={joinOrgId}
                    onChange={(e) => setJoinOrgId(e.target.value)}
                  >
                    {suggested.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label="מזהה ארגון" hint="קבלי מהמנהל של הארגון">
                  <input
                    className="field font-mono text-xs"
                    value={joinOrgId}
                    onChange={(e) => setJoinOrgId(e.target.value)}
                    placeholder="00000000-0000-0000-0000-000000000000"
                  />
                </Field>
              )}

              <Field label="סיסמת הצטרפות">
                <div className="relative">
                  <input
                    className="field pe-10"
                    type={showPassword ? "text" : "password"}
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 left-2 flex items-center text-ink-400 hover:text-ink-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>

              {error && <ErrorBox>{error}</ErrorBox>}

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full"
              >
                {submitting ? "מצטרפת..." : "הצטרפות לארגון"}
              </button>
            </form>
          )}
        </div>

        <button
          onClick={signOut}
          className="mt-6 text-sm text-ink-500 hover:text-ink-700 w-full text-center"
        >
          התחברות עם חשבון אחר
        </button>
      </motion.div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink-800 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-500 mt-1">{hint}</span>}
    </label>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-danger-500/10 border border-danger-500/20 rounded-xl px-3 py-2 text-sm text-danger-600">
      {children}
    </div>
  );
}
