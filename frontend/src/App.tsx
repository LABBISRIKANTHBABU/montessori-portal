import React, { Component, FormEvent, ReactNode, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight, Award, BarChart3, Bell, Calendar, ChevronDown, CircleHelp, FileBadge2,
  GraduationCap, LayoutDashboard, LogOut, Menu, Plus, Search, Settings, Sparkles,
  Upload, UserRound, Users, WalletCards, X, Shield, Building2, CheckCircle2,
  AlertTriangle, Clock, CreditCard, FileText, Moon
} from "lucide-react";
import { api, apiConfigurationError, DashboardData, GroupOverview, School, SearchResult, Notification, schoolScope, token } from "./api";
import { ToastProvider } from "./components/Toast";
import { filterVisibleGroupOverview, orderVisibleSchools } from "./schools/visibleSchools";

// New design system components
import { LoginPage } from "./components/LoginPage";
import { SuperAdminDashboard } from "./components/SuperAdminDashboard";
import { SchoolDashboard } from "./components/SchoolDashboard";
import { Sidebar } from "./components/Sidebar";
import { LoadingPage } from "./components/ui";

const StudentCreatePage = React.lazy(() => import("./features/students/StudentCreatePage"));
const StudentsPage = React.lazy(() => import("./features/students/StudentsPage"));
const StudentProfilePage = React.lazy(() => import("./features/students/StudentProfilePage"));
const ImportPage = React.lazy(() => import("./features/students/ImportPage"));
const DocumentsPage = React.lazy(() => import("./features/documents/DocumentsPage"));
const CertificatesPage = React.lazy(() => import("./features/certificates/CertificatesPage"));
const AccountsPage = React.lazy(() => import("./features/accounts/AccountsPage"));
const EventsPage = React.lazy(() => import("./features/events/EventsPage"));
const ReportsPage = React.lazy(() => import("./features/reports/ReportsPage"));
const UsersPageFull = React.lazy(() => import("./features/users/UsersPage"));
const SettingsPage = React.lazy(() => import("./features/settings/SettingsPage"));

const GROUP_LOGO = "/montessori-golden-jubilee-logo.jpeg";
const academicYearScopeKey = (schoolId: number) => `monte_academic_year_scope:${schoolId}`;

type Session = {
  user: { name: string; role: string; roleCode: string; permissions: string[] };
  school: School;
} | null;

// ─── Error Boundary ─────────────────────────────────────────────────────

interface ErrorBoundaryState { hasError: boolean; error: Error | null }
class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error("[ErrorBoundary]", error, info.componentStack); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", background: "#0f1117", color: "#e2e4e9" }}>
          <div style={{ textAlign: "center", maxWidth: 480, padding: "2rem" }}>
            <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Something went wrong</h1>
            <p style={{ color: "#8b8fa3", marginBottom: "1.5rem" }}>An unexpected error occurred. Please refresh the page or contact support if the issue persists.</p>
            <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              style={{ padding: "0.6rem 1.5rem", background: "#6c5ce7", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Loading Skeleton ───────────────────────────────────────────────────

export function Skeleton({ width = "100%", height = 20, borderRadius = 6, style }: { width?: string | number; height?: number | string; borderRadius?: number; style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width, height, borderRadius,
        background: "linear-gradient(90deg, #e8eee9 25%, #dcd8cc 50%, #e8eee9 75%)",
        backgroundSize: "200% 100%",
        animation: "skeleton-shimmer 1.5s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

export function TextSkeleton({ lines = 3, style }: { lines?: number; style?: React.CSSProperties }) {
  return (
    <div className="skeleton-text" style={style} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton-text-line" />
      ))}
    </div>
  );
}

export function CardSkeleton({ style }: { style?: React.CSSProperties }) {
  return (
    <div className="skeleton-card" style={style} aria-hidden="true">
      <div className="skeleton-card-header">
        <div className="skeleton-avatar" />
        <div style={{ flex: 1 }}>
          <Skeleton width="60%" height={14} borderRadius={4} />
          <Skeleton width="40%" height={10} borderRadius={4} style={{ marginTop: 8 }} />
        </div>
      </div>
      <div className="skeleton-card-body">
        <Skeleton height={10} borderRadius={4} />
        <Skeleton height={10} borderRadius={4} />
        <Skeleton width="70%" height={10} borderRadius={4} />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5, style }: { rows?: number; cols?: number; style?: React.CSSProperties }) {
  return (
    <div style={style} aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="skeleton-table-row" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height={14} borderRadius={4} />
          ))}
        </div>
      ))}
    </div>
  );
}

const skeletonStyles = document.createElement("style");
skeletonStyles.textContent = `@keyframes skeleton-shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`;
if (!document.getElementById("skeleton-keyframes")) { skeletonStyles.id = "skeleton-keyframes"; document.head.appendChild(skeletonStyles); }

function App() {
  const [session, setSession] = useState<Session>(() => {
    const raw = localStorage.getItem("monte_session");
    return raw ? JSON.parse(raw) : null;
  });
  const [sessionError, setSessionError] = useState("");
  useEffect(() => {
    if (!session || (session.user.permissions?.length && session.user.roleCode)) return;
    api.accessModel().then(({ data }) => {
      const upgraded = {
        ...session,
        user: { ...session.user, roleCode: data.role, permissions: data.permissions },
      };
      setSession(upgraded);
      localStorage.setItem("monte_session", JSON.stringify(upgraded));
    }).catch(() => {
      token.clear();
      schoolScope.clear();
      localStorage.removeItem("monte_session");
      setSession(null);
      setSessionError("Your session has expired. Please log in again.");
    });
  }, [session]);
  const signIn = (next: NonNullable<Session>, jwtToken?: string) => {
    if (jwtToken) token.set(jwtToken);
    if (next.user.role === "Group Super Admin") schoolScope.set(next.school.id);
    else schoolScope.clear();
    setSession(next);
    localStorage.setItem("monte_session", JSON.stringify(next));
  };
  const signOut = () => {
    void api.logout().catch(() => undefined);
    token.clear();
    schoolScope.clear();
    localStorage.removeItem("monte_session");
    setSession(null);
  };

  return (
    <ErrorBoundary>
      <ToastProvider>
        <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>Loading...</div>}>
          <Routes>
            <Route path="/" element={<Landing sessionError={sessionError} />} />
            <Route path="/login/:schoolId" element={session ? <Navigate to="/dashboard" /> : <LoginPage onLogin={signIn} isSuperAdmin={false} />} />
            <Route path="/super-admin" element={session ? <Navigate to="/dashboard" /> : <LoginPage onLogin={signIn} isSuperAdmin={true} />} />
            <Route path="/forgot-password" element={session ? <Navigate to="/dashboard" /> : <PasswordRecovery mode="request" />} />
            <Route path="/reset-password" element={session ? <Navigate to="/dashboard" /> : <PasswordRecovery mode="reset" />} />
            <Route path="/*" element={session ? <Portal session={session} onLogout={signOut} /> : <Navigate to="/" />} />
          </Routes>
        </Suspense>
      </ToastProvider>
    </ErrorBoundary>
  );
}

// ─── Landing Page ────────────────────────────────────────────────────────
// School cards, search, super admin card. No login form, no demo stats.

function ApiConnectionStatus({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<"checking" | "online" | "degraded" | "offline">("checking");
  const [message, setMessage] = useState("Checking backend connection...");

  useEffect(() => {
    let cancelled = false;
    api.health()
      .then(result => {
        if (cancelled) return;
        if (result.checks?.database === false || result.database?.ok === false) {
          setState("degraded");
          setMessage(result.message || "Backend is running, but database health is not confirmed.");
          return;
        }
        setState("online");
        setMessage(`Backend connected${result.database?.latencyMs !== undefined ? ` · DB ${result.database.latencyMs}ms` : ""}`);
      })
      .catch(error => {
        if (cancelled) return;
        setState("offline");
        setMessage(error instanceof Error ? error.message : "Backend is not reachable.");
      });
    return () => { cancelled = true; };
  }, []);

  const Icon = state === "online" ? CheckCircle2 : state === "checking" ? Clock : AlertTriangle;
  return (
    <div className={`api-status api-status-${state}${compact ? " compact" : ""}`} role="status" aria-live="polite">
      <Icon size={compact ? 14 : 17} />
      <span>{message}</span>
    </div>
  );
}

function AuthLayout({
  eyebrow,
  title,
  subtitle,
  roleBadge,
  backLabel,
  onBack,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  roleBadge: string;
  backLabel: string;
  onBack: () => void;
  children: ReactNode;
}) {
  const supportedRoles = ["Super Admin", "School Admin", "Teacher", "Accountant", "Reception"];
  return (
    <main className="login-page auth-layout">
      <button className="back-link auth-back-link" onClick={onBack}>
        <ArrowRight size={15} /> {backLabel}
      </button>

      <section className="auth-hero">
        <div className="auth-hero-card">
          <Brand light />
          <span className="auth-role-badge"><Shield size={15} /> {roleBadge}</span>
          <div>
            <span className="eyebrow light">{eyebrow}</span>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="auth-role-strip" aria-label="Supported portal roles">
            {supportedRoles.map(role => <span key={role}>{role}</span>)}
          </div>
          <blockquote>
            "The education of even a small child does not aim at preparing him for school, but for life."
            <cite>— Maria Montessori</cite>
          </blockquote>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-panel-inner">
          {children}
          <footer className="auth-footer">
            <span>Montessori Group ERP</span>
            <span>Secure school operations portal</span>
          </footer>
        </div>
      </section>
    </main>
  );
}

function Landing({ sessionError }: { sessionError?: string }) {
  const navigate = useNavigate();
  const [schools, setSchools] = useState<School[]>([]);
  const [loadError, setLoadError] = useState(apiConfigurationError);
  useEffect(() => {
    api.schools().then(r => {
      setSchools(orderVisibleSchools(r.data));
      setLoadError("");
    })
      .catch(reason => setLoadError(reason instanceof Error ? reason.message : "Schools could not be loaded."));
  }, []);

  return (
    <main className="landing-new">
      <nav className="landing-nav">
        <Brand />
        <button className="text-button super-admin-link" onClick={() => navigate("/super-admin")}>
          <Shield size={16} /> Platform Admin
        </button>
      </nav>

      <section className="landing-header">
        <span className="eyebrow">MONTESSORI GROUP OF SCHOOLS</span>
        <h1>Select your campus</h1>
        <p>Choose your school to sign in to your workspace.</p>
        <ApiConnectionStatus />
      </section>

      <section className="school-grid">
        {sessionError && <div className="form-error" role="alert" style={{ marginBottom: "var(--space-4)" }}>{sessionError}</div>}
        {loadError && <div className="form-error" role="alert">{loadError}</div>}
        {schools.map((school, i) => (
          <button key={school.id} className="school-card" style={{ animationDelay: `${i * 60}ms` }} onClick={() => navigate(`/login/${school.id}`)}>
            <div className="school-icon">
              <img src={GROUP_LOGO} alt="" aria-hidden="true" />
            </div>
            <div className="school-details">
              <strong>{school.name}</strong>
              {school.city && <small><Building2 size={13} /> {school.city}</small>}
            </div>
            <ArrowRight size={20} className="card-arrow" />
          </button>
        ))}
      </section>

      <footer className="landing-foot">
        <span>Montessori Group of Schools</span>
        <span>ERP Platform v1.0</span>
      </footer>
    </main>
  );
}

// ─── Login Page ──────────────────────────────────────────────────────────
// School-specific or Super Admin login. No demo hints.

function Login({ onLogin, isSuperAdmin }: { onLogin: (session: NonNullable<Session>) => void; isSuperAdmin: boolean }) {
  const navigate = useNavigate();
  const { schoolId: paramSchoolId } = useParams();
  const [schools, setSchools] = useState<School[]>([]);
  const schoolId = isSuperAdmin ? 0 : Number(paramSchoolId || 1);
  const targetSchool = schools.find(s => s.id === schoolId);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => { api.schools().then(r => setSchools(orderVisibleSchools(r.data))).catch(() => undefined); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const result = await api.login({ schoolId: isSuperAdmin ? 0 : schoolId, email, password });
      token.set(result.token);
      onLogin({ user: result.user, school: result.school });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Please check your credentials.");
    } finally { setLoading(false); }
  }

  const loginTitle = isSuperAdmin ? "Platform Administration" : targetSchool?.name || "School Portal";
  const loginSubtitle = isSuperAdmin
    ? "Group-wide access for campus governance, approvals, reports, users and operations."
    : `${targetSchool?.city || "Campus"} portal for school admin, teachers, accounts and reception teams.`;

  return (
    <AuthLayout
      eyebrow={isSuperAdmin ? "GLOBAL PLATFORM ACCESS" : "SECURE CAMPUS ACCESS"}
      title={loginTitle}
      subtitle={loginSubtitle}
      roleBadge={isSuperAdmin ? "Super Admin" : "School Workspace"}
      backLabel="Back to schools"
      onBack={() => navigate("/")}
    >
      <section className="login-panel">
        <form className="auth-form" onSubmit={submit}>
          <span className="step-label">{isSuperAdmin ? "SUPER ADMIN ACCESS" : "STAFF LOGIN"}</span>
          <h2>{isSuperAdmin ? "Sign in to command centre" : "Sign in to your school"}</h2>
          <p className="muted">Use your official staff credentials. Sessions are protected and school-scoped.</p>
          <ApiConnectionStatus compact />
          <label>
            Email address
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
          </label>
          <button
            type="button"
            className="text-button auth-forgot-link"
            onClick={() => navigate(`/forgot-password?schoolId=${schoolId}&email=${encodeURIComponent(email)}`)}
          >
            Forgot password?
          </button>
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button wide auth-submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in securely"} <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </AuthLayout>
  );
}

function PasswordRecovery({ mode }: { mode: "request" | "reset" }) {
  const navigate = useNavigate();
  const params = new URLSearchParams(useLocation().search);
  const schoolId = Number(params.get("schoolId") || 0);
  const resetToken = params.get("token") || "";
  const [email, setEmail] = useState(params.get("email") || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (mode === "reset" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const result = mode === "request"
        ? await api.forgotPassword({ schoolId, email })
        : await api.resetOwnPassword({ schoolId, token: resetToken, newPassword: password });
      setMessage(result.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Password recovery failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="SECURE ACCOUNT RECOVERY"
      title={mode === "request" ? "Reset your password" : "Choose a new password"}
      subtitle="Recovery links are single-use and expire after 30 minutes."
      roleBadge="Account Recovery"
      backLabel="Back to sign in"
      onBack={() => navigate(schoolId ? `/login/${schoolId}` : "/super-admin")}
    >
      <section className="login-panel">
        <form className="auth-form" onSubmit={submit}>
          <span className="step-label">PASSWORD RECOVERY</span>
          <h2>{mode === "request" ? "Find your account" : "Create new password"}</h2>
          {mode === "request" ? (
            <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></label>
          ) : (
            <>
              <label>New password<input type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" /></label>
              <label>Confirm password<input type="password" minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password" /></label>
            </>
          )}
          {error && <div className="form-error">{error}</div>}
          {message && <div className="status-message success">{message}</div>}
          <button className="primary-button wide" disabled={loading || (mode === "reset" && !resetToken)}>
            {loading ? "Please wait..." : mode === "request" ? "Send reset link" : "Update password"} <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </AuthLayout>
  );
}

// ─── Navigation Config ───────────────────────────────────────────────────

const navItems = [
  ["dashboard", "Overview", LayoutDashboard, "dashboard.view"],
  ["students", "Students", Users, "student.view"],
  ["certificates", "Certificates", FileBadge2, "certificate.view"],
  ["fees", "Fees & Accounts", WalletCards, "account.view"],
  ["documents", "Documents", FileBadge2, "student.document.upload"],
  ["events", "Events", Calendar, "event.view"],
  ["reports", "Reports", BarChart3, "report.view"],
  ["users", "Staff & Roles", Users, "user.manage"],
  ["settings", "Settings", Settings, "settings.view"]
] as const;

const superAdminNavItems = [
  ["dashboard", "Platform Overview", LayoutDashboard, "dashboard.view"],
  ["schools", "Campuses", GraduationCap, "dashboard.view"],
  ["students", "Students", Users, "student.view"],
  ["certificates", "Certificates", FileBadge2, "certificate.view"],
  ["fees", "Fees & Accounts", WalletCards, "account.view"],
  ["documents", "Documents", FileText, "student.document.upload"],
  ["events", "Events", Calendar, "event.view"],
  ["users", "Staff & Roles", Users, "user.manage"],
  ["reports", "Global Reports", BarChart3, "report.view"],
  ["settings", "School Settings", Settings, "settings.view"],
] as const;

// ─── Portal (Main App Shell) ─────────────────────────────────────────────

function Portal({ session, onLogout }: { session: NonNullable<Session>; onLogout: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const current = location.pathname.split("/")[1] || "dashboard";
  const creatingStudent = location.pathname === "/students/new";
  const managingImports = location.pathname === "/students/imports";
  const studentId = /^\/students\/(\d+)$/.exec(location.pathname)?.[1];
  const isSuperAdmin = session.user.role === "Group Super Admin";
  const permissions = new Set(session.user.permissions || []);
  const configuredNavItems = isSuperAdmin ? superAdminNavItems : navItems;
  const visibleNavItems = configuredNavItems.filter(([, , , permission]) => permissions.has(permission));
  const currentNavItem = configuredNavItems.find(([path]) => path === current);
  const canOpenCurrentModule = !currentNavItem || permissions.has(currentNavItem[3]);
  const [availableSchools, setAvailableSchools] = useState<School[]>([session.school]);
  const [activeSchool, setActiveSchool] = useState<School>(session.school);
  const [academicYears, setAcademicYears] = useState<string[]>([]);
  const [activeAcademicYear, setActiveAcademicYear] = useState("");
  const scopedSession = { ...session, school: activeSchool };

  useEffect(() => {
    if (!isSuperAdmin) return;
    api.schools().then(({ data }) => {
      const visibleSchools = orderVisibleSchools(data);
      setAvailableSchools(visibleSchools);
      const savedId = Number(schoolScope.get());
      const selected = visibleSchools.find(school => school.id === savedId) || visibleSchools.find(school => school.id === session.school.id) || visibleSchools[0];
      if (selected) {
        schoolScope.set(selected.id);
        setActiveSchool(selected);
      }
    }).catch(() => undefined);
  }, [isSuperAdmin, session.school.id]);

  const selectCampus = (school: School, destination?: string) => {
    schoolScope.set(school.id);
    setActiveSchool(school);
    setSearchQuery("");
    setSearchResults([]);
    if (destination) navigate(destination);
  };

  useEffect(() => {
    let cancelled = false;
    api.academicSetup()
      .then(({ data }) => {
        if (cancelled) return;
        const years = data.academicYears || [];
        const savedYear = localStorage.getItem(academicYearScopeKey(activeSchool.id)) || "";
        setAcademicYears(years);
        setActiveAcademicYear(savedYear && years.includes(savedYear) ? savedYear : "");
      })
      .catch(() => {
        if (cancelled) return;
        setAcademicYears([]);
        setActiveAcademicYear("");
      });
    return () => { cancelled = true; };
  }, [activeSchool.id]);

  const selectAcademicYear = (year: string) => {
    setActiveAcademicYear(year);
    if (year) localStorage.setItem(academicYearScopeKey(activeSchool.id), year);
    else localStorage.removeItem(academicYearScopeKey(activeSchool.id));
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    api.notifications().then(r => {
      setNotifications(r.data.notifications);
      setUnreadCount(r.data.unreadCount);
    }).catch(() => undefined);
  }, [current, activeSchool.id]);

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (value.length < 2) { setSearchResults([]); setSearchOpen(false); return; }
    searchTimerRef.current = setTimeout(() => {
      setSearchLoading(true);
      api.search(value).then(r => { setSearchResults(r.data); setSearchOpen(true); }).catch(() => setSearchResults([])).finally(() => setSearchLoading(false));
    }, 300);
  }, []);

  const markAllRead = () => {
    api.markNotificationsRead().then(() => {
      setNotifications(n => n.map(x => ({ ...x, read: true })));
      setUnreadCount(0);
    }).catch(() => undefined);
  };

  const moduleIcons: Record<string, typeof Users> = { students: Users, events: Calendar, certificates: FileBadge2, fees: WalletCards, documents: FileText, users: Users };
  const typeColors: Record<string, string> = { student: "#002147", event: "#2e8b57", certificate: "#e6a700", receipt: "#3a7bd5", supplier: "#d9534f", user: "#002147" };

  return (
    <div className="app-shell">
      <Sidebar
        session={session}
        isSuperAdmin={isSuperAdmin}
        activeSchool={activeSchool}
        availableSchools={availableSchools}
        currentModule={current}
        onSelectCampus={selectCampus}
        onLogout={onLogout}
        open={menu}
        onToggle={() => setMenu(!menu)}
      />
      <main className="workspace">
        <header className="workspace-header">
          <div className="workspace-header-left">
            <button className="btn btn-ghost btn-icon mobile-menu-btn" onClick={() => setMenu(true)}><Menu size={18} /></button>
            <div className="school-context">
              <img src={GROUP_LOGO} alt="" style={{ width: 20, height: 20, borderRadius: 4, objectFit: "cover" }} />
              <span className="school-context-name">{activeSchool.name}</span>
            </div>
          </div>

          <div className="workspace-header-center">
            <div className="header-search search-box" ref={searchRef}>
              <Search size={15} />
              <input
                placeholder="Search students, events, certificates..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                onFocus={() => searchQuery.length >= 2 && setSearchOpen(true)}
              />
              {searchOpen && (
                <div className="dropdown" style={{ left: 0, right: 0, width: "100%", maxHeight: 360, overflowY: "auto" }}>
                  {searchLoading ? (
                    <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--color-text-tertiary)" }}>
                      <div className="spinner" style={{ margin: "0 auto 8px" }} /> Searching...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--color-text-tertiary)" }}>No results found</div>
                  ) : (
                    Object.entries(searchResults.reduce((acc, r) => { (acc[r.type] = acc[r.type] || []).push(r); return acc; }, {} as Record<string, SearchResult[]>)).map(([type, items]) => (
                      <div key={type}>
                        <div style={{ padding: "8px 16px", fontSize: 10, fontWeight: 700, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{type}s</div>
                        {items.map(item => (
                          <button key={`${item.type}-${item.id}`} className="dropdown-item" onClick={() => { navigate(`/${item.module}`); setSearchOpen(false); setSearchQuery(""); }}>
                            <span style={{ width: 28, height: 28, borderRadius: 8, background: `${typeColors[item.type] || "#002147"}15`, color: typeColors[item.type] || "#002147", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {(() => { const Ic = moduleIcons[item.module] || Users; return <Ic size={14} />; })()}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</div>
                              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.subtitle}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="workspace-header-right">
            {isSuperAdmin && academicYears.length > 0 && (
              <select
                className="input select"
                style={{ maxWidth: 160, minHeight: 36, fontSize: 13, borderRadius: "var(--radius-md)" }}
                aria-label="Academic year"
                value={activeAcademicYear}
                onChange={e => selectAcademicYear(e.target.value)}
              >
                <option value="">All years</option>
                {academicYears.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            )}
            <div ref={notifRef} style={{ position: "relative" }}>
              <button className="header-icon-btn" aria-label="Notifications" onClick={() => setNotifOpen(o => !o)}>
                <Bell size={18} />
                {unreadCount > 0 && <span className="notification-dot" />}
              </button>
              {notifOpen && (
                <div className="dropdown" style={{ width: 340, maxHeight: 400, overflowY: "auto", right: 0 }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Notifications</span>
                    {unreadCount > 0 && (
                      <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Mark all read</button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 13 }}>No notifications</div>
                  ) : (
                    notifications.map(n => (
                      <button
                        key={n.id}
                        className="dropdown-item"
                        style={{ flexDirection: "column", alignItems: "flex-start", opacity: n.read ? 0.6 : 1 }}
                        onClick={() => { if (n.module) navigate(`/${n.module}`); setNotifOpen(false); }}
                      >
                        <span style={{ fontWeight: n.read ? 400 : 600 }}>{n.title}</span>
                        <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>{n.message}</span>
                        <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>{new Date(n.createdAt).toLocaleString()}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <button className="header-icon-btn" aria-label="Settings" title="Settings" onClick={() => navigate("/settings")}>
              <Settings size={18} />
            </button>
          </div>
        </header>
        <div className="workspace-content">
          {!canOpenCurrentModule ? (
            <div className="page">
              <div className="alert alert-danger" role="alert">You do not have permission to open this module.</div>
            </div>
          ) : <React.Fragment key={`${activeSchool.id}:${current}`}>
            {current === "dashboard" && (isSuperAdmin
              ? <SuperAdminDashboard session={scopedSession} activeSchool={activeSchool} onSelectCampus={selectCampus} />
              : <SchoolDashboard session={scopedSession} />)}
            {current === "students" && (creatingStudent
              ? <StudentCreatePage school={activeSchool} academicYear={activeAcademicYear} />
              : managingImports ? <ImportPage />
                : studentId ? <StudentProfilePage id={Number(studentId)} />
                  : <StudentsPage selectedAcademicYear={activeAcademicYear} />)}
            {current === "schools" && isSuperAdmin && <SchoolsPage activeSchoolId={activeSchool.id} onSelectCampus={selectCampus} />}
            {current === "users" && <UsersPageFull />}
            {current === "certificates" && <CertificatesPage />}
            {current === "fees" && <AccountsPage />}
            {current === "documents" && <DocumentsPage />}
            {current === "events" && <EventsPage />}
            {current === "reports" && <ReportsPage />}
            {current === "settings" && <SettingsPage />}
            {!["dashboard", "students", "schools", "users", "certificates", "fees", "documents", "events", "reports", "settings"].includes(current) && (
              <ModulePlaceholder name={configuredNavItems.find(n => n[0] === current)?.[1] || "Module"} />
            )}
          </React.Fragment>}
        </div>
      </main>
    </div>
  );
}

// ─── Schools Page ───────────────────────────────────────────────────────

function SchoolsPage({
  activeSchoolId, onSelectCampus
}: {
  activeSchoolId: number;
  onSelectCampus: (school: School, destination?: string) => void;
}) {
  const [data, setData] = useState<GroupOverview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api.groupOverview().then(result => setData(filterVisibleGroupOverview(result.data)))
      .catch(reason => setError(reason instanceof Error ? reason.message : "Campuses could not be loaded."));
  }, []);
  return (
    <div className="page">
      <div className="page-title">
        <div><span className="eyebrow">CAMPUS DIRECTORY</span><h1>Choose where to work.</h1><p>Selection changes the secure school scope for every module.</p></div>
      </div>
      {error ? <div className="form-error" role="alert">{error}</div> : data
        ? <CampusPortfolio data={data} activeSchoolId={activeSchoolId} onSelectCampus={onSelectCampus} />
        : <section className="metrics"><Metric label="Loading..." value="..." note="Fetching campuses" icon={Building2} /></section>}
    </div>
  );
}

function CampusPortfolio({
  data, activeSchoolId, onSelectCampus
}: {
  data: GroupOverview;
  activeSchoolId: number;
  onSelectCampus: (school: School, destination?: string) => void;
}) {
  return (
    <section className="campus-portfolio">
      <div className="portfolio-heading">
        <div><span className="step-label">CAMPUS OPERATIONS</span><h2>School-by-school command</h2></div>
        <span>{data.schools.length} active campuses</span>
      </div>
      <div className="campus-ops-grid">
        {data.schools.map(school => (
          <article className={`campus-ops-card ${school.id === activeSchoolId ? "selected" : ""}`} key={school.id}>
            <div className="campus-ops-top">
              <span className="campus-index">{String(school.id).padStart(2, "0")}</span>
              {school.id === activeSchoolId && <span className="live-scope">ACTIVE SCOPE</span>}
            </div>
            <h3>{school.name}</h3>
            <p><Building2 size={14} /> {school.city || "Location not configured"}</p>
            <div className="campus-mini-metrics">
              <span><strong>{school.students}</strong>Students</span>
              <span><strong>{school.staff}</strong>Staff</span>
              <span><strong>{school.events}</strong>Events</span>
              <span><strong>₹{school.fees.toLocaleString("en-IN")}</strong>Fees</span>
            </div>
            <div className="campus-card-actions">
              <button className="primary-button" onClick={() => onSelectCampus(school, "/students")}>Manage school <ArrowRight size={15} /></button>
              <button className="secondary-button" onClick={() => onSelectCampus(school, "/dashboard")}>Set scope</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AccessResponsibilityPanel({ role }: { role: "super" | "school" }) {
  const isSuper = role === "super";
  const responsibilities = isSuper
    ? ["Operate every active campus", "Manage all users and school administrators", "Change academics, fees, events, certificates and settings", "Review group-wide reports and audit activity"]
    : ["Operate only the assigned campus", "Manage campus staff without granting Group Super Admin", "Maintain students, academics, fees, events and certificates", "Cannot read or change another school's records"];
  return (
    <section className={`access-contract ${isSuper ? "group" : "school"}`}>
      <div className="access-contract-intro">
        <Shield size={24} />
        <div><span>{isSuper ? "ALL-SCHOOL AUTHORITY" : "SINGLE-SCHOOL AUTHORITY"}</span><h2>{isSuper ? "Group Super Admin" : "School Admin"}</h2></div>
      </div>
      <div className="access-rules">
        {responsibilities.map(rule => <span key={rule}><CheckCircle2 size={16} /> {rule}</span>)}
      </div>
    </section>
  );
}

// ─── School Dashboard ────────────────────────────────────────────────────
// ─── Utility Components ─────────────────────────────────────────────────

function Metric({ label, value, note, icon: Icon, accent = false }: { label: string; value: string | number; note: string; icon: typeof Users; accent?: boolean }) {
  return (
    <article className={accent ? "metric accent" : "metric"}>
      <span className="metric-icon"><Icon size={20} /></span>
      <small>{label}</small>
      <strong>{value}</strong>
      <p><span className="status-dot" /> {note}</p>
    </article>
  );
}

function ModulePlaceholder({ name }: { name: string }) {
  return (
    <div className="page">
      <div className="module-placeholder">
        <span><Sparkles /></span>
        <p className="eyebrow">COMING SOON</p>
        <h1>{name}</h1>
        <p>This module is under development and will be available in a future release.</p>
      </div>
    </div>
  );
}

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={light ? "brand light" : "brand"}>
      <span className="brand-logo-shell">
        <img className="brand-logo" src={GROUP_LOGO} alt="Montessori Golden Jubilee emblem" />
      </span>
      <div><strong>Montessori</strong><small>SCHOOL PORTAL</small></div>
    </div>
  );
}

export default App;
