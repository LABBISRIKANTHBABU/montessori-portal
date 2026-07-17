import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Shield,
  Sparkles,
} from "lucide-react";
import { api, token, School } from "../api";
import { orderVisibleSchools } from "../schools/visibleSchools";

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
          setMessage("Database connection degraded");
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

  return (
    <div className={`login-status login-status-${state}`} role="status" aria-live="polite">
      <Icon size={14} />
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

  useEffect(() => {
    if (isSuperAdmin) return;
    api.schools()
      .then(({ data }) => {
        const visible = orderVisibleSchools(data);
        setTargetSchool(visible.find((school) => school.id === numericSchoolId) || null);
      })
      .catch(() => undefined);
  }, [isSuperAdmin, numericSchoolId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api.login({ schoolId: isSuperAdmin ? 0 : numericSchoolId, email, password });
      token.set(result.token);
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
  const eyebrow = isSuperAdmin ? "GLOBAL PLATFORM ACCESS" : "SECURE CAMPUS ACCESS";
  const formTitle = isSuperAdmin ? "Welcome back, Super Admin" : "Welcome back";
  const roleBadge = isSuperAdmin ? "Super Admin" : "School Workspace";
  const highlights = useMemo(
    () => isSuperAdmin
      ? ["All campuses", "Approvals", "Reports", "Governance"]
      : ["Students", "Attendance", "Certificates", "Fees"],
    [isSuperAdmin],
  );

  return (
    <main className="login-screen">
      <button className="login-back-button" onClick={() => navigate("/")}>
        <ArrowRight size={14} />
        Back to schools
      </button>

      <section className="login-brand-panel" aria-label="Montessori portal introduction">
        <div className="login-brand-card">
          <div className="login-brand-top">
            <span className="login-logo-lockup">
              <img src={GROUP_LOGO} alt="Montessori logo" />
            </span>
            <div>
              <strong>Montessori</strong>
              <small>GROUP OF SCHOOLS</small>
            </div>
          </div>

          <span className="login-role-pill">
            {isSuperAdmin ? <Shield size={14} /> : <Building2 size={14} />}
            {roleBadge}
          </span>

          <div className="login-brand-copy">
            <span>{eyebrow}</span>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className="login-feature-row">
            {highlights.map((item) => (
              <span key={item}>
                <Sparkles size={13} />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="login-form-panel" aria-label="Sign in form">
        <div className="login-card">
          <div className="login-card-header">
            <div className="login-card-logo">
              <img src={GROUP_LOGO} alt="Montessori logo" />
            </div>
            <span>{eyebrow}</span>
            <h2>{formTitle}</h2>
            <p>Use your official staff credentials to continue to the Montessori ERP workspace.</p>
          </div>

          <ConnectionStatus />

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label>Email address</label>
              <div className="login-input-wrap">
                <Mail size={17} />
                <input
                  type="email"
                  placeholder="you@school.edu"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="login-field">
              <label>Password</label>
              <div className="login-input-wrap">
                <Lock size={17} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error" role="alert">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in securely
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            <button
              type="button"
              className="login-forgot-button"
              onClick={() => navigate(`/forgot-password?schoolId=${numericSchoolId}&email=${encodeURIComponent(email)}`)}
            >
              Forgot password?
            </button>
          </form>

          <footer className="login-footer">
            <span>Montessori Group ERP</span>
            <span>Protected school portal</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
