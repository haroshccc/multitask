import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, Users, Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

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

  // join org state — by name + password
  const [joinName, setJoinName] = useState("");
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
          setJoinName((data as SuggestedOrg[])[0].name);
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
    if (!joinName.trim() || joinPassword.length < 1) {
      setError("הזיני שם ארגון וסיסמה");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { data, error: rpcErr } = await db.rpc("join_organization_by_name_and_password", {
      p_name: joinName.trim(),
      p_join_password: joinPassword,
    });
    if (rpcErr) {
      setError("שגיאת שרת — נסי שוב");
      setSubmitting(false);
      return;
    }
    const result = data as { ok: boolean; error?: string };
    if (!result.ok) {
      const msgs: Record<string, string> = {
        org_not_found: "ארגון בשם זה לא נמצא",
        wrong_password: "סיסמה שגויה",
        org_has_no_password: "לארגון זה אין סיסמת הצטרפות — בקשי הזמנה מהמנהל",
        not_authenticated: "יש להתחבר מחדש",
      };
      setError(msgs[result.error ?? ""] ?? "שגיאה לא ידועה");
      setSubmitting(false);
      return;
    }
    await refreshProfile();
    navigate("/app", { replace: true });
  };

  const handleSkip = () => {
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
          <p className="text-ink-600">נכנסת כ־{userEmail}.</p>
        </div>

        {/* Mode switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-ink-100 rounded-2xl mb-6">
          <button
            onClick={() => { setMode("create"); setError(null); }}
            className={cn(
              "flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all",
              mode === "create" ? "bg-white shadow-soft text-ink-900" : "text-ink-600"
            )}
          >
            <Building2 className="w-4 h-4" />
            ארגון חדש
          </button>
          <button
            onClick={() => { setMode("join"); setError(null); }}
            className={cn(
              "flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all",
              mode === "join" ? "bg-white shadow-soft text-ink-900" : "text-ink-600"
            )}
          >
            <Users className="w-4 h-4" />
            הצטרפות לקיים
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
                <PasswordInput
                  value={newPassword}
                  onChange={setNewPassword}
                  show={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                  placeholder="סיסמה חזקה"
                />
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

              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting ? "יוצרת..." : "צרי ארגון"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <Field label="שם הארגון" hint="הזיני את השם המדויק של הארגון שאת מצטרפת אליו">
                <input
                  className="field"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  placeholder="שם הארגון"
                  autoFocus
                />
              </Field>

              <Field label="סיסמת הצטרפות">
                <PasswordInput
                  value={joinPassword}
                  onChange={setJoinPassword}
                  show={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                  placeholder="קבלי מהמנהל של הארגון"
                />
              </Field>

              {error && <ErrorBox>{error}</ErrorBox>}

              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting ? "מצטרפת..." : "הצטרפות לארגון"}
              </button>
            </form>
          )}
        </div>

        {/* Skip — enter app without org */}
        <button
          onClick={handleSkip}
          className="mt-4 flex items-center justify-center gap-1.5 text-sm text-ink-500 hover:text-ink-700 w-full"
        >
          <ArrowLeft className="w-4 h-4" />
          המשכי ללא ארגון — אוכל להצטרף בהגדרות
        </button>

        <button
          onClick={signOut}
          className="mt-3 text-sm text-ink-400 hover:text-ink-600 w-full text-center"
        >
          התחברות עם חשבון אחר
        </button>
      </motion.div>
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  show,
  onToggle,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <input
        className="field pe-10"
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute inset-y-0 end-2 flex items-center text-ink-400 hover:text-ink-700"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
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
