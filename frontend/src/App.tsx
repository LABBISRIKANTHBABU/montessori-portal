import React, { Component, FormEvent, ReactNode, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight, Award, BarChart3, Bell, Calendar, ChevronDown, CircleHelp, FileBadge2,
  GraduationCap, LayoutDashboard, LogOut, Menu, Plus, Search, Settings, Sparkles,
  Upload, UserRound, Users, WalletCards, X, Shield, Building2, CheckCircle2,
  AlertTriangle, Clock, CreditCard, FileText
} from "lucide-react";
import { api, DashboardData, School, SearchResult, Notification, token } from "./api";
import { ToastProvider } from "./components/Toast";
import StudentCreatePage from "./features/students/StudentCreatePage";
import StudentsPage from "./features/students/StudentsPage";
import StudentProfilePage from "./features/students/StudentProfilePage";
import ImportPage from "./features/students/ImportPage";
import DocumentsPage from "./features/documents/DocumentsPage";
import CertificatesPage from "./features/certificates/CertificatesPage";
import AccountsPage from "./features/accounts/AccountsPage";
import EventsPage from "./features/events/EventsPage";
import ReportsPage from "./features/reports/ReportsPage";
import UsersPageFull from "./features/users/UsersPage";
import SettingsPage from "./features/settings/SettingsPage";

type Session = { user: { name: string; role: string }; school: School; mustChangePassword?: boolean } | null;

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
  const signIn = (next: NonNullable<Session>) => {
    setSession(next);
    localStorage.setItem("monte_session", JSON.stringify(next));
  };
  const signOut = () => {
    void api.logout().catch(() => undefined);
    token.clear();
    localStorage.removeItem("monte_session");
    setSession(null);
  };

  return (
    <ErrorBoundary>
      <ToastProvider>
        <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>Loading...</div>}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login/:schoolId" element={session ? <Navigate to="/dashboard" /> : <Login onLogin={signIn} isSuperAdmin={false} />} />
            <Route path="/super-admin" element={session ? <Navigate to="/dashboard" /> : <Login onLogin={signIn} isSuperAdmin={true} />} />
            <Route path="/change-password" element={session ? <ChangePassword session={session} onComplete={() => signIn({ ...session, mustChangePassword: false })} /> : <Navigate to="/" />} />
            <Route path="/*" element={session ? (session.mustChangePassword ? <Navigate to="/change-password" /> : <Portal session={session} onLogout={signOut} />) : <Navigate to="/" />} />
          </Routes>
        </Suspense>
      </ToastProvider>
    </ErrorBoundary>
  );
}

// ─── Landing Page ────────────────────────────────────────────────────────
// School cards, search, super admin card. No login form, no demo stats.

function Landing() {
  const navigate = useNavigate();
  const [schools, setSchools] = useState<School[]>([]);
  const [search, setSearch] = useState("");
  useEffect(() => { api.schools().then(r => setSchools(r.data)).catch(() => undefined); }, []);

  const filtered = schools.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.city.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase())
  );

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
        <div className="search-bar-large">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search by school name, city, or code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </section>

      <section className="school-grid">
        {filtered.map(school => (
          <button key={school.id} className="school-card" onClick={() => navigate(`/login/${school.id}`)}>
            <div className="school-icon"><GraduationCap size={24} /></div>
            <div className="school-details">
              <strong>{school.name}</strong>
              <small><Building2 size={13} /> {school.city}</small>
            </div>
            <ArrowRight size={20} className="card-arrow" />
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="empty-state">
            <Search size={32} />
            <p>No schools found matching "{search}"</p>
          </div>
        )}
      </section>

      <div className="landing-foot">
        <span>Montessori Group of Schools</span>
        <span>ERP Platform v1.0</span>
      </div>
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
  useEffect(() => { api.schools().then(r => setSchools(r.data)).catch(() => undefined); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const result = await api.login({ schoolId: isSuperAdmin ? 0 : schoolId, email, password });
      token.set(result.token);
      onLogin({ user: result.user, school: result.school, mustChangePassword: result.mustChangePassword });
      navigate(result.mustChangePassword ? "/change-password" : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Please check your credentials.");
    } finally { setLoading(false); }
  }

  return (
    <main className="login-page">
      <button className="back-link" onClick={() => navigate("/")}>
        <ArrowRight size={15} /> Back to schools
      </button>
      <section className="login-intro">
        <Brand light />
        <div>
          <span className="eyebrow light">{isSuperAdmin ? "GLOBAL PLATFORM" : "SECURE ACCESS"}</span>
          <h1>{isSuperAdmin ? "Platform Administration" : targetSchool?.name || "School Portal"}</h1>
          <p>{isSuperAdmin
            ? "Group-wide metrics, campus management, and platform oversight."
            : `${targetSchool?.city || ""} — Sign in with your staff credentials.`
          }</p>
        </div>
        <blockquote>"The education of even a small child does not aim at preparing him for school, but for life."<cite>— Maria Montessori</cite></blockquote>
      </section>
      <section className="login-panel">
        <form onSubmit={submit}>
          <span className="step-label">{isSuperAdmin ? "SUPER ADMIN ACCESS" : "STAFF LOGIN"}</span>
          <h2>{isSuperAdmin ? "Platform Admin" : "Sign in"}</h2>
          <p className="muted">Enter your credentials to access the portal.</p>
          <label>
            Email address
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button wide" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"} <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </main>
  );
}

// ─── Change Password ─────────────────────────────────────────────────────

function ChangePassword({ session, onComplete }: { session: NonNullable<Session>; onComplete: () => void }) {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (values.newPassword !== values.confirmPassword) return setError("New passwords do not match.");
    setLoading(true); setError("");
    try {
      const result = await api.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      token.set(result.token);
      onComplete();
      navigate("/dashboard");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Password change failed.");
    } finally { setLoading(false); }
  }

  return (
    <main className="login-page">
      <section className="login-intro">
        <Brand light />
        <div>
          <span className="eyebrow light">SECURE YOUR ACCOUNT</span>
          <h1>One careful first step.</h1>
          <p>Create a private password before entering {session.school.name}.</p>
        </div>
      </section>
      <section className="login-panel">
        <form onSubmit={submit}>
          <span className="step-label">REQUIRED ON FIRST LOGIN</span>
          <h2>Change password</h2>
          <p className="muted">Use 4+ characters.</p>
          <label>Current password<input name="currentPassword" type="password" required /></label>
          <label>New password<input name="newPassword" type="password" minLength={4} required /></label>
          <label>Confirm new password<input name="confirmPassword" type="password" minLength={4} required /></label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button wide" disabled={loading}>
            {loading ? "Securing..." : "Secure account"} <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </main>
  );
}

// ─── Navigation Config ───────────────────────────────────────────────────

const navItems = [
  ["dashboard", "Overview", LayoutDashboard],
  ["students", "Students", Users],
  ["certificates", "Certificates", FileBadge2],
  ["fees", "Fees & Accounts", WalletCards],
  ["documents", "Documents", FileBadge2],
  ["events", "Events", Calendar],
  ["reports", "Reports", BarChart3],
  ["users", "Staff & Roles", Users],
  ["settings", "Settings", Settings]
] as const;

const superAdminNavItems = [
  ["dashboard", "Platform Overview", LayoutDashboard],
  ["schools", "Campuses", GraduationCap],
  ["users", "Staff & Roles", Users],
  ["reports", "Global Reports", BarChart3]
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
  }, [current]);

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
  const typeColors: Record<string, string> = { student: "#6c5ce7", event: "#00b894", certificate: "#fdcb6e", receipt: "#0984e3", supplier: "#e17055", user: "#a29bfe" };

  return (
    <div className="portal">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <div className="side-brand">
          <Brand light />
          <button className="icon-button mobile-only" onClick={() => setMenu(false)}><X /></button>
        </div>
        <div className="campus-card">
          <span className="campus-mark">{session.school.code.slice(0, 2)}</span>
          <div><small>CURRENT CAMPUS</small><strong>{session.school.name}</strong></div>
        </div>
        <nav>
          <span className="nav-label">WORKSPACE</span>
          {(isSuperAdmin ? superAdminNavItems : navItems).map(([path, label, Icon]) => (
            <button key={path} className={current === path ? "active" : ""} onClick={() => { navigate(`/${path}`); setMenu(false); }}>
              <Icon size={19} /> {label}
            </button>
          ))}
        </nav>
        <div className="side-user">
          <span>{session.user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}</span>
          <div><strong>{session.user.name}</strong><small>{session.user.role}</small></div>
          <button onClick={onLogout} title="Sign out"><LogOut size={17} /></button>
        </div>
      </aside>
      <main className="workspace">
        <header>
          <button className="icon-button mobile-only" onClick={() => setMenu(true)}><Menu /></button>
          <div className="header-search" ref={searchRef} style={{ position: "relative" }}>
            <Search size={18} />
            <input
              placeholder="Search students, events, certificates..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              onFocus={() => searchQuery.length >= 2 && setSearchOpen(true)}
            />
            {searchOpen && (
              <div className="search-dropdown" style={{
                position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
                background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 10,
                maxHeight: 360, overflowY: "auto", zIndex: 100, boxShadow: "0 8px 32px rgba(0,0,0,.4)"
              }}>
                {searchLoading ? (
                  <div style={{ padding: "1.5rem", textAlign: "center", color: "#8b8fa3" }}>Searching...</div>
                ) : searchResults.length === 0 ? (
                  <div style={{ padding: "1.5rem", textAlign: "center", color: "#8b8fa3" }}>No results found</div>
                ) : (
                  <>
                    {Object.entries(searchResults.reduce((acc, r) => { (acc[r.type] = acc[r.type] || []).push(r); return acc; }, {} as Record<string, SearchResult[]>)).map(([type, items]) => (
                      <div key={type}>
                        <div style={{ padding: "0.5rem 1rem", fontSize: 11, fontWeight: 700, color: "#8b8fa3", textTransform: "uppercase", letterSpacing: "0.05em" }}>{type}s</div>
                        {items.map(item => (
                          <button key={`${item.type}-${item.id}`} className="search-result-item" style={{
                            display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "0.6rem 1rem",
                            background: "none", border: "none", color: "#e2e4e9", cursor: "pointer", textAlign: "left"
                          }} onClick={() => { navigate(`/${item.module}`); setSearchOpen(false); setSearchQuery(""); }}>
                            <span style={{ width: 32, height: 32, borderRadius: 8, background: `${typeColors[item.type] || "#6c5ce7"}22`, color: typeColors[item.type] || "#6c5ce7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {(() => { const Ic = moduleIcons[item.module] || Users; return <Ic size={16} />; })()}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</div>
                              <div style={{ fontSize: 11, color: "#8b8fa3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.subtitle}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          <div className="header-actions">
            <button className="icon-button"><CircleHelp size={19} /></button>
            <div ref={notifRef} style={{ position: "relative" }}>
              <button className="icon-button alert" onClick={() => setNotifOpen(o => !o)} style={{ position: "relative" }}>
                <Bell size={19} />
                {unreadCount > 0 && (
                  <span style={{
                    position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: "50%",
                    background: "#e74c3c", color: "#fff", fontSize: 10, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
                )}
              </button>
              {notifOpen && (
                <div style={{
                  position: "absolute", top: "100%", right: 0, marginTop: 4, width: 340,
                  background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 10,
                  maxHeight: 400, overflowY: "auto", zIndex: 100, boxShadow: "0 8px 32px rgba(0,0,0,.4)"
                }}>
                  <div style={{ padding: "0.8rem 1rem", borderBottom: "1px solid #2a2d3e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: 14 }}>Notifications</strong>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} style={{ background: "none", border: "none", color: "#6c5ce7", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Mark all read</button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: "2rem", textAlign: "center", color: "#8b8fa3", fontSize: 13 }}>No notifications</div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} style={{
                        padding: "0.7rem 1rem", borderBottom: "1px solid #2a2d3e",
                        background: n.read ? "transparent" : "#6c5ce710",
                        opacity: n.read ? 0.6 : 1, cursor: "pointer"
                      }} onClick={() => { if (n.module) navigate(`/${n.module}`); setNotifOpen(false); }}>
                        <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600 }}>{n.title}</div>
                        <div style={{ fontSize: 11, color: "#8b8fa3", marginTop: 2 }}>{n.message}</div>
                        <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>{new Date(n.createdAt).toLocaleString()}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <span className="year-pill">2026–27 <ChevronDown size={15} /></span>
          </div>
        </header>
        {current === "dashboard" && (isSuperAdmin ? <SuperAdminDashboard session={session} /> : <Dashboard session={session} />)}
        {current === "students" && (creatingStudent ? <StudentCreatePage school={session.school} /> : managingImports ? <ImportPage /> : studentId ? <StudentProfilePage id={Number(studentId)} /> : <StudentsPage />)}
        {current === "schools" && <SchoolsPage />}
        {current === "users" && <UsersPageFull />}
        {current === "certificates" && <CertificatesPage />}
        {current === "fees" && <AccountsPage />}
        {current === "documents" && <DocumentsPage />}
        {current === "events" && <EventsPage />}
        {current === "reports" && <ReportsPage />}
        {current === "settings" && <SettingsPage />}
        {!["dashboard", "students", "schools", "users", "certificates", "fees", "documents", "events", "reports", "settings"].includes(current) && (
          <ModulePlaceholder name={(isSuperAdmin ? superAdminNavItems : navItems).find(n => n[0] === current)?.[1] || "Module"} />
        )}
      </main>
    </div>
  );
}

// ─── Super Admin Dashboard ───────────────────────────────────────────────
// Loads real data from API. No hardcoded statistics.

function SuperAdminDashboard({ session }: { session: NonNullable<Session> }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.dashboard().then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">GLOBAL PLATFORM</span>
          <h1>Welcome, {session.user.name}.</h1>
          <p>Group-wide metrics across all campuses.</p>
        </div>
      </div>
      {loading ? (
        <section className="metrics">
          <Metric label="Loading..." value="..." note="Fetching data" icon={Users} />
        </section>
      ) : data ? (
        <section className="metrics">
          <Metric label="Total students" value={data.totals?.students ?? "—"} note="Across all campuses" icon={Users} />
          <Metric label="Active students" value={data.totals?.active ?? "—"} note="Currently enrolled" icon={UserRound} />
          <Metric label="Campuses" value={data.totals?.schools ?? "—"} note="All systems online" icon={GraduationCap} />
          <Metric label="Pending actions" value={data.totals?.pendingCertificates ?? "—"} note="Requires attention" icon={Award} accent />
        </section>
      ) : (
        <section className="metrics">
          <Metric label="Campuses" value="—" note="All systems online" icon={GraduationCap} />
        </section>
      )}
    </div>
  );
}

function SchoolsPage() {
  return <ModulePlaceholder name="Campuses Management" />;
}

// ─── School Dashboard ────────────────────────────────────────────────────
// Role-based dashboard with extended widgets.

function Dashboard({ session }: { session: NonNullable<Session> }) {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [extData, setExtData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const role = session.user.role;

  useEffect(() => {
    Promise.all([api.dashboard(), api.dashboardExtended()])
      .then(([base, ext]) => { setData(base.data); setExtData(ext.data); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const today = new Date();
  const dayName = today.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const dateStr = today.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  const roleWidgets = getRoleWidgets(role);
  const quickActions = getQuickActions(role, navigate);

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">{dayName}, {dateStr}</span>
          <h1>Welcome, {session.user.name.split(" ")[0]}.</h1>
          <p>{roleDashboardSubtitle(role)}</p>
        </div>
        {quickActions.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {quickActions.map((action, i) => (
              <button key={i} className="primary-button" onClick={action.onClick} style={{ fontSize: 13 }}>
                <action.icon size={16} /> {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <section className="metrics">
          <Metric label="Loading..." value="..." note="Fetching data" icon={Users} />
        </section>
      ) : (
        <>
          <section className="metrics">
            {roleWidgets.map((w, i) => (
              <Metric
                key={i}
                label={w.label}
                value={extData ? (w.key ? extData[w.key] : undefined) ?? (w.altKey ? data?.totals?.[w.altKey] : undefined) ?? "—" : (w.altKey ? data?.totals?.[w.altKey] : undefined) ?? "—"}
                note={w.note}
                icon={w.icon}
                accent={w.accent}
              />
            ))}
          </section>

          <section className="dashboard-grid">
            {role !== "Parent" && (
              <article className="panel activity-panel">
                <div className="panel-head">
                  <div><span className="step-label">RECENT ACTIVITY</span><h3>Latest actions</h3></div>
                </div>
                <div className="activity-list">
                  {(extData?.recentActivity || data?.recent || []).slice(0, 8).map((item: any, i: number) => (
                    <div className="activity" key={i}>
                      <span className={`activity-icon tone-${i % 3}`}>
                        {item.module === "students" ? <Users size={17} /> :
                         item.module === "certificates" ? <FileBadge2 size={17} /> :
                         item.module === "fees" ? <WalletCards size={17} /> :
                         item.module === "events" ? <Calendar size={17} /> :
                         <FileBadge2 size={17} />}
                      </span>
                      <div>
                        <strong>{item.action || item.title}</strong>
                        <small>{item.detail || item.meta}</small>
                      </div>
                      <time>{item.time}</time>
                    </div>
                  ))}
                  {(!extData?.recentActivity && !data?.recent) && <p className="muted" style={{ padding: "2rem", textAlign: "center" }}>No recent activity.</p>}
                </div>
              </article>
            )}

            {extData?.pendingTasks && extData.pendingTasks.length > 0 && (
              <article className="panel">
                <div className="panel-head">
                  <div><span className="step-label">PENDING TASKS</span><h3>Needs attention</h3></div>
                </div>
                <div style={{ padding: "0.5rem 1rem" }}>
                  {extData.pendingTasks.map((task: any) => (
                    <button key={task.id} style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "0.7rem 0",
                      background: "none", border: "none", borderBottom: "1px solid #2a2d3e",
                      color: "#e2e4e9", cursor: "pointer", textAlign: "left"
                    }} onClick={() => navigate(`/${task.module}`)}>
                      <span style={{
                        width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                        background: task.count > 0 ? "#e74c3c22" : "#00b89422",
                        color: task.count > 0 ? "#e74c3c" : "#00b894", flexShrink: 0
                      }}>
                        {task.count > 0 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{task.task}</div>
                      </div>
                      {task.count > 0 && (
                        <span style={{
                          background: "#e74c3c22", color: "#e74c3c", padding: "2px 8px", borderRadius: 12,
                          fontSize: 11, fontWeight: 700
                        }}>{task.count}</span>
                      )}
                      <ArrowRight size={14} style={{ color: "#8b8fa3" }} />
                    </button>
                  ))}
                </div>
              </article>
            )}

            {data?.enrollmentByClass && data.enrollmentByClass.length > 0 && (
              <article className="panel chart-panel">
                <div className="panel-head">
                  <div><span className="step-label">ENROLMENT</span><h3>Students by class</h3></div>
                  <button className="text-button" onClick={() => navigate("/reports")}>View report <ArrowRight size={15} /></button>
                </div>
                <div className="bar-chart">
                  {data.enrollmentByClass.map((item: any) => {
                    const max = Math.max(...data.enrollmentByClass.map((v: any) => v.value), 1);
                    return (
                      <div className="bar-item" key={item.label}>
                        <span>{item.value}</span>
                        <i style={{ height: `${Math.max(12, item.value / max * 100)}%` }} />
                        <small>{item.label}</small>
                      </div>
                    );
                  })}
                </div>
              </article>
            )}

            <QuickActionsPanel role={role} navigate={navigate} />
          </section>
        </>
      )}
    </div>
  );
}

function roleDashboardSubtitle(role: string): string {
  switch (role) {
    case "School Admin": return "Full overview of your school operations.";
    case "Principal": return "Academic overview and key metrics.";
    case "Office Staff": return "Student and document operations at a glance.";
    case "Teacher": return "Your class activity and events.";
    case "Accountant": return "Financial overview and fee collection status.";
    case "Parent": return "Your children's activity and updates.";
    default: return "Here's the pulse of your school today.";
  }
}

function getRoleWidgets(role: string) {
  switch (role) {
    case "School Admin":
      return [
        { label: "Total students", key: "totalStudents", altKey: "students", note: "All enrolled", icon: Users },
        { label: "Active today", key: "activeStudents", altKey: "active", note: "Currently active", icon: UserRound },
        { label: "Fees collected today", key: "feesCollectedToday", note: "Daily collection", icon: WalletCards },
        { label: "Pending tasks", key: "pendingCertificates", altKey: "pendingCertificates", note: "Requires action", icon: Award, accent: true },
      ];
    case "Principal":
      return [
        { label: "Total students", key: "totalStudents", altKey: "students", note: "Enrolled this year", icon: Users },
        { label: "Active students", key: "activeStudents", altKey: "active", note: "Currently enrolled", icon: UserRound },
        { label: "Pending certificates", key: "pendingCertificates", altKey: "pendingCertificates", note: "Awaiting approval", icon: FileBadge2 },
        { label: "Draft events", key: "draftEvents", note: "Not yet published", icon: Calendar },
      ];
    case "Office Staff":
      return [
        { label: "Total students", key: "totalStudents", altKey: "students", note: "Current year", icon: Users },
        { label: "Pending certificates", key: "pendingCertificates", altKey: "pendingCertificates", note: "To process", icon: FileBadge2 },
        { label: "Fees collected today", key: "feesCollectedToday", note: "Daily collection", icon: WalletCards },
        { label: "Active students", key: "activeStudents", altKey: "active", note: "Currently enrolled", icon: UserRound },
      ];
    case "Teacher":
      return [
        { label: "Active students", key: "activeStudents", altKey: "active", note: "In your classes", icon: Users },
        { label: "Upcoming events", key: "draftEvents", note: "This month", icon: Calendar },
        { label: "Fees collected", key: "feesCollectedToday", note: "Today", icon: WalletCards },
        { label: "Pending tasks", key: "pendingCertificates", altKey: "pendingCertificates", note: "Action needed", icon: Clock },
      ];
    case "Accountant":
      return [
        { label: "Fees collected today", key: "feesCollectedToday", note: "Daily collection", icon: WalletCards },
        { label: "Pending payments", key: "unpaidFees", note: "Students with dues", icon: CreditCard, accent: true },
        { label: "Total students", key: "totalStudents", altKey: "students", note: "All enrolled", icon: Users },
        { label: "Active students", key: "activeStudents", altKey: "active", note: "Currently active", icon: UserRound },
      ];
    case "Parent":
      return [
        { label: "My children", key: "totalStudents", altKey: "students", note: "Enrolled", icon: Users },
        { label: "Fees pending", key: "unpaidFees", note: "Outstanding", icon: WalletCards },
        { label: "Certificates", key: "pendingCertificates", altKey: "pendingCertificates", note: "Available", icon: FileBadge2 },
        { label: "Events", key: "draftEvents", note: "Upcoming", icon: Calendar },
      ];
    default:
      return [
        { label: "Total students", key: "totalStudents", altKey: "students", note: "Across current year", icon: Users },
        { label: "Active students", key: "activeStudents", altKey: "active", note: "Currently enrolled", icon: UserRound },
        { label: "Campuses", key: "schools", altKey: "schools", note: "All systems online", icon: GraduationCap },
        { label: "TC requests", key: "pendingCertificates", altKey: "pendingCertificates", note: "Awaiting approval", icon: Award, accent: true },
      ];
  }
}

function getQuickActions(role: string, navigate: any) {
  const actions: { label: string; icon: typeof Users; onClick: () => void }[] = [];
  if (["School Admin", "Office Staff", "Principal"].includes(role)) {
    actions.push({ label: "Add Student", icon: Plus, onClick: () => navigate("/students/new") });
  }
  if (["School Admin", "Principal", "Office Staff"].includes(role)) {
    actions.push({ label: "Create Event", icon: Calendar, onClick: () => navigate("/events") });
  }
  if (["School Admin", "Accountant", "Office Staff"].includes(role)) {
    actions.push({ label: "Record Payment", icon: WalletCards, onClick: () => navigate("/fees") });
  }
  if (["School Admin", "Office Staff"].includes(role)) {
    actions.push({ label: "Issue Certificate", icon: FileBadge2, onClick: () => navigate("/certificates") });
  }
  return actions;
}

function QuickActionsPanel({ role, navigate }: { role: string; navigate: any }) {
  const actions: { label: string; desc: string; icon: typeof Users; path: string; color: string }[] = [];

  if (["School Admin", "Office Staff", "Principal"].includes(role)) {
    actions.push({ label: "Add Student", desc: "New admission", icon: Users, path: "/students/new", color: "#6c5ce7" });
  }
  if (["School Admin", "Principal", "Office Staff"].includes(role)) {
    actions.push({ label: "Create Event", desc: "Plan event", icon: Calendar, path: "/events", color: "#00b894" });
  }
  if (["School Admin", "Accountant", "Office Staff"].includes(role)) {
    actions.push({ label: "Record Payment", desc: "Collect fee", icon: WalletCards, path: "/fees", color: "#0984e3" });
  }
  if (["School Admin", "Office Staff"].includes(role)) {
    actions.push({ label: "Issue Certificate", desc: "Generate TC", icon: FileBadge2, path: "/certificates", color: "#fdcb6e" });
  }
  if (["School Admin", "Teacher"].includes(role)) {
    actions.push({ label: "View Reports", desc: "Analytics", icon: BarChart3, path: "/reports", color: "#e17055" });
  }

  if (actions.length === 0) return null;

  return (
    <article className="panel">
      <div className="panel-head">
        <div><span className="step-label">QUICK ACTIONS</span><h3>Shortcuts</h3></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, padding: "0.75rem 1rem" }}>
        {actions.map((a, i) => (
          <button key={i} onClick={() => navigate(a.path)} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            padding: "1rem 0.5rem", background: "#1a1d2e", border: "1px solid #2a2d3e",
            borderRadius: 10, cursor: "pointer", color: "#e2e4e9", transition: "border-color 0.15s"
          }} onMouseEnter={e => (e.currentTarget.style.borderColor = a.color)} onMouseLeave={e => (e.currentTarget.style.borderColor = "#2a2d3e")}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: `${a.color}22`, color: a.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <a.icon size={18} />
            </span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{a.label}</span>
            <span style={{ fontSize: 10, color: "#8b8fa3" }}>{a.desc}</span>
          </button>
        ))}
      </div>
    </article>
  );
}

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

function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={light ? "brand light" : "brand"}>
      <span className="brand-mark"><i /><i /><i /></span>
      <div><strong>Montessori</strong><small>SCHOOL PORTAL</small></div>
    </div>
  );
}

export default App;
