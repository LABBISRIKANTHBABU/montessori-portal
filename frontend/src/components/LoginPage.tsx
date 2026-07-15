import React, { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Shield, CheckCircle2, Clock, AlertTriangle, Lock, Mail, GraduationCap } from "lucide-react";
import { api, School } from "../api";
import { orderVisibleSchools } from "../schools/visibleSchools";
import { Brand } from "../App";

const GROUP_LOGO = "/montessori-golden-jubilee-logo.jpeg";

function ConnectionStatus() {
  const [state, setState] = useState<"checking" | "online" | "degraded" | "offline">("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    api.health()
      .then((result) => {
        if (cancelled) return;
        if (result.checks?.database === false || result.database?.ok === false) {
          setState("degraded");
          setMessage("Database degraded");
          return;
        }
        setState("online");
        setMessage(result.database?.latencyMs !== undefined ? `Connected · ${result.database.latencyMs}ms` : "Connected");
      })
      .catch(() => {
        if (cancelled) return;
        setState("offline");
        setMessage("Backend offline");
      });
    return () => { cancelled = true; };
  }, []);

  const Icon = state === "online" ? CheckCircle2 : state === "checking" ? Clock : AlertTriangle;
  const color = state === "online" ? "var(--color-success)" : state === "degraded" ? "var(--color-warning)" : "var(--color-danger)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color }}>
      <Icon size={13} />
      <span>{message || "Checking connection..."}</span>
    </div>
  );
}

interface LoginPageProps {
  onLogin: (session: { user: { name: string; role: string; roleCode: string; permissions: string[] }; school: School }) => void;
  isSuperAdmin: boolean;
}

export function LoginPage({ onLogin, isSuperAdmin }: LoginPageProps) {
  const navigate = useNavigate();
  const { schoolId } = useParams();
  const numericSchoolId = Number(schoolId || 0);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [targetSchool, setTargetSchool] = useState<School | null>(null);
  const [schools, setSchools] = useState<School[]>([]);

  useEffect(() => {
    if (isSuperAdmin) return;
    api.schools().then(({ data }) => {
      const visible = orderVisibleSchools(data);
      setSchools(visible);
      setTargetSchool(visible.find((s) => s.id === numericSchoolId) || null);
    }).catch(() => undefined);
  }, [isSuperAdmin, numericSchoolId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api.login({ schoolId: isSuperAdmin ? 0 : numericSchoolId, email, password });
      onLogin({ user: result.user, school: result.school });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  const title = isSuperAdmin ? "Platform Administration" : targetSchool?.name || "School Portal";
  const subtitle = isSuperAdmin
    ? "Group-wide access for campus governance, approvals, reports, and operations."
    : `${targetSchool?.city || "Campus"} portal for school administration, teachers, and staff.`;

  const supportedRoles = ["Super Admin", "School Admin", "Teacher", "Accountant", "Reception"];

  return (
    <main className="auth-layout">
      {/* Hero Panel */}
      <section className="auth-hero">
        <div className="auth-hero-card">
          <div className="brand" style={{ marginBottom: "var(--space-8)" }}>
            <span className="brand-logo-shell" style={{ width: 40, height: 40 }}>
              <img src={GROUP_LOGO} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }} />
            </span>
            <div>
              <strong style={{ fontSize: 18 }}>Montessori</strong>
              <small style={{ fontSize: 9, letterSpacing: "0.2em", opacity: 0.5 }}>SCHOOL PORTAL</small>
            </div>
          </div>

          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "rgba(249, 228, 183, 0.12)", border: "1px solid rgba(249, 228, 183, 0.25)", borderRadius: 999, fontSize: 11, fontWeight: 700, color: "#f9e4b7", letterSpacing: "0.08em", marginBottom: "var(--space-6)" }}>
            <Shield size={13} />
            {isSuperAdmin ? "SUPER ADMIN" : "SCHOOL WORKSPACE"}
          </div>

          <h1>{title}</h1>
          <p>{subtitle}</p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "var(--space-8)" }}>
            {supportedRoles.map((role) => (
              <span key={role} style={{ padding: "7px 12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 999, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 600 }}>
                {role}
              </span>
            ))}
          </div>

          <blockquote style={{ margin: 0, padding: "20px 0 0", borderTop: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 1.7 }}>
            "The education of even a small child does not aim at preparing him for school, but for life."
            <cite style={{ display: "block", marginTop: 10, color: "#f9e4b7", fontStyle: "normal", fontWeight: 700 }}>— Maria Montessori</cite>
          </blockquote>
        </div>
      </section>

      {/* Login Panel */}
      <section className="auth-panel">
        <div className="auth-panel-inner">
          <button
            className="auth-back-link"
            onClick={() => navigate("/")}
          >
            <ArrowRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to schools
          </button>

          <div className="auth-form-header" style={{ marginTop: "var(--space-8)" }}>
            <span className="eyebrow" style={{ color: "var(--color-text-tertiary)", marginBottom: "var(--space-3)", display: "block" }}>
              {isSuperAdmin ? "GLOBAL PLATFORM ACCESS" : "SECURE CAMPUS ACCESS"}
            </span>
            <h2>{isSuperAdmin ? "Sign in to command centre" : "Sign in to your school"}</h2>
            <p style={{ color: "var(--color-text-secondary)", marginTop: "var(--space-2)", lineHeight: 1.6 }}>
              Use your official staff credentials. Sessions are protected and school-scoped.
            </p>
          </div>

          <ConnectionStatus />

          <form className="auth-form" onSubmit={handleSubmit} style={{ marginTop: "var(--space-6)" }}>
            <div className="field">
              <label className="field-label">Email address</label>
              <div style={{ position: "relative" }}>
                <Mail size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-tertiary)" }} />
                <input
                  type="email"
                  className="input"
                  style={{ paddingLeft: 40 }}
                  placeholder="you@school.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="field">
              <label className="field-label">Password</label>
              <div style={{ position: "relative" }}>
                <Lock size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-tertiary)" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  className="input"
                  style={{ paddingLeft: 40, paddingRight: 44 }}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", padding: 6, color: "var(--color-text-tertiary)", borderRadius: "var(--radius-md)" }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: "var(--color-danger-light)", border: "1px solid var(--color-danger-border)", borderRadius: "var(--radius-lg)", color: "var(--color-red-700)", fontSize: 13 }}>
                <AlertTriangle size={15} />
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: "var(--space-2)" }} disabled={loading}>
              {loading ? (
                <><span className="spinner" /> Signing in...</>
              ) : (
                <>Sign in securely <ArrowRight size={16} /></>
              )}
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--space-2)" }}>
              <button
                type="button"
                onClick={() => navigate(`/forgot-password?schoolId=${numericSchoolId}&email=${encodeURIComponent(email)}`)}
                style={{ background: "none", border: "none", color: "var(--color-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Forgot password?
              </button>
            </div>
          </form>

          <footer style={{ marginTop: "var(--space-10)", paddingTop: "var(--space-5)", borderTop: "1px solid var(--color-border-subtle)", display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--color-text-tertiary)", fontWeight: 600 }}>
            <span>Montessori Group ERP</span>
            <span>Secure school portal</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
