import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, WalletCards, FileBadge2, Calendar, TrendingUp, ArrowUpRight,
  Clock, AlertCircle, Plus, Upload, FileText, BarChart3, Settings, Bell
} from "lucide-react";
import { api, DashboardData, School } from "../api";
import { Card, CardBody, StatCard, Spinner, EmptyState } from "./ui";

const GROUP_LOGO = "/montessori-golden-jubilee-logo.jpeg";

interface SchoolDashboardProps {
  session: { user: { name: string; role: string }; school: School };
}

export function SchoolDashboard({ session }: SchoolDashboardProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.dashboard()
      .then(({ data }) => setData(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <div className="page">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <div>
            <div className="skeleton" style={{ width: 180, height: 14, marginBottom: 10 }} />
            <div className="skeleton" style={{ width: 280, height: 28 }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-4)" }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton" style={{ height: 100, borderRadius: "var(--radius-xl)" }} />
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--space-6)" }}>
            <div className="skeleton" style={{ height: 280, borderRadius: "var(--radius-xl)" }} />
            <div className="skeleton" style={{ height: 280, borderRadius: "var(--radius-xl)" }} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  const totals = data?.totals;
  const recent = data?.recent || [];

  return (
    <div className="page">
      {/* Hero Section */}
      <div style={{ marginBottom: "var(--space-8)" }}>
        <p className="body-sm" style={{ color: "var(--color-text-tertiary)", marginBottom: "var(--space-1)" }}>
          {greeting()}, {session.user.name.split(" ")[0]}
        </p>
        <h1 className="heading-2" style={{ marginBottom: "var(--space-2)" }}>
          {session.school.name}
        </h1>
        <p className="body" style={{ color: "var(--color-text-secondary)", maxWidth: 500 }}>
          School administration dashboard. Manage students, fees, certificates, and events.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="metrics-row" style={{ marginBottom: "var(--space-6)" }}>
        <StatCard
          label="Total Students"
          value={totals?.students?.toLocaleString() || "0"}
          icon={<Users size={18} />}
        />
        <StatCard
          label="Fee Collection"
          value={`₹${(totals?.fees || 0).toLocaleString("en-IN")}`}
          icon={<WalletCards size={18} />}
        />
        <StatCard
          label="Certificates"
          value={totals?.certificates?.toString() || "0"}
          icon={<FileBadge2 size={18} />}
        />
        <StatCard
          label="Events"
          value={totals?.events?.toString() || "0"}
          icon={<Calendar size={18} />}
        />
      </div>

      {/* Content Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--space-6)", marginBottom: "var(--space-6)" }}>
        {/* Recent Activity */}
        <Card>
          <div className="card-header">
            <h3 className="heading-5">Recent Activity</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate("/students")}>
              View all students
            </button>
          </div>
          <CardBody>
            {recent.length === 0 ? (
              <EmptyState
                icon={<Clock size={24} />}
                title="No recent activity"
                description="Activity will appear here as students are added and events occur."
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {recent.slice(0, 8).map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex", alignItems: "center", gap: "var(--space-3)",
                      padding: "12px 0",
                      borderBottom: i < recent.length - 1 ? "1px solid var(--color-border-subtle)" : "none",
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: "var(--radius-full)", background: "var(--color-success)", flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{item.meta}</div>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", whiteSpace: "nowrap" }}>{item.time}</span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Quick Actions + Enrollment */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {/* Quick Actions */}
          <Card>
            <div className="card-header">
              <h3 className="heading-5">Quick Actions</h3>
            </div>
            <CardBody>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                {[
                  { icon: <Plus size={16} />, label: "Add Student", path: "/students/new", color: "var(--color-primary)" },
                  { icon: <Upload size={16} />, label: "Bulk Import", path: "/students/imports", color: "var(--color-info)" },
                  { icon: <FileBadge2 size={16} />, label: "Certificates", path: "/certificates", color: "var(--color-warning)" },
                  { icon: <WalletCards size={16} />, label: "Collect Fees", path: "/fees", color: "var(--color-success)" },
                ].map((action) => (
                  <button
                    key={action.path}
                    onClick={() => navigate(action.path)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-2)",
                      padding: "var(--space-4)", background: "var(--color-gray-50)", border: "1px solid var(--color-border-subtle)",
                      borderRadius: "var(--radius-lg)", cursor: "pointer", transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-surface)"; e.currentTarget.style.borderColor = "var(--color-border-strong)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-gray-50)"; e.currentTarget.style.borderColor = "var(--color-border-subtle)"; e.currentTarget.style.transform = "none"; }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: `${action.color}15`, color: action.color, display: "grid", placeItems: "center" }}>
                      {action.icon}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text)" }}>{action.label}</span>
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Enrollment by Class */}
          <Card>
            <div className="card-header">
              <h3 className="heading-5">Enrollment by Class</h3>
            </div>
            <CardBody>
              {data?.enrollmentByClass && data.enrollmentByClass.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  {data.enrollmentByClass.slice(0, 6).map((item) => {
                    const maxVal = Math.max(...data.enrollmentByClass.map((e) => e.value));
                    const percent = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
                    return (
                      <div key={item.label}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span className="body-sm" style={{ fontWeight: 500 }}>{item.label}</span>
                          <span className="body-sm" style={{ fontWeight: 700, color: "var(--color-text)" }}>{item.value}</span>
                        </div>
                        <div className="progress">
                          <div className="progress-bar" style={{ width: `${percent}%`, background: "var(--color-primary)" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="body-sm" style={{ color: "var(--color-text-tertiary)", textAlign: "center", padding: "var(--space-8) 0" }}>
                  No enrollment data available
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Bottom Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)" }}>
        <Card>
          <CardBody>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <div style={{ width: 40, height: 40, borderRadius: "var(--radius-lg)", background: "var(--color-primary-light)", display: "grid", placeItems: "center", color: "var(--color-primary)" }}>
                <Users size={18} />
              </div>
              <div>
                <div className="body-sm" style={{ color: "var(--color-text-tertiary)" }}>Active Students</div>
                <div style={{ fontWeight: 700, fontSize: 20 }}>{totals?.active?.toLocaleString() || "0"}</div>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <div style={{ width: 40, height: 40, borderRadius: "var(--radius-lg)", background: "var(--color-warning-light)", display: "grid", placeItems: "center", color: "var(--color-warning)" }}>
                <FileBadge2 size={18} />
              </div>
              <div>
                <div className="body-sm" style={{ color: "var(--color-text-tertiary)" }}>Pending Certificates</div>
                <div style={{ fontWeight: 700, fontSize: 20 }}>{totals?.pendingCertificates?.toLocaleString() || "0"}</div>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <div style={{ width: 40, height: 40, borderRadius: "var(--radius-lg)", background: "var(--color-success-light)", display: "grid", placeItems: "center", color: "var(--color-success)" }}>
                <Calendar size={18} />
              </div>
              <div>
                <div className="body-sm" style={{ color: "var(--color-text-tertiary)" }}>Upcoming Events</div>
                <div style={{ fontWeight: 700, fontSize: 20 }}>{totals?.events?.toLocaleString() || "0"}</div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
