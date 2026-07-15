import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  GraduationCap, Users, WalletCards, FileBadge2, Calendar, TrendingUp,
  TrendingDown, ArrowUpRight, Clock, AlertCircle, Building2, BookOpen,
  CreditCard, FileText, BarChart3, Plus, Upload, Settings, Bell
} from "lucide-react";
import { api, GroupOverview, School } from "../api";
import { Card, CardBody, StatCard, Badge, Spinner, EmptyState } from "./ui";

const GROUP_LOGO = "/montessori-golden-jubilee-logo.jpeg";

interface SuperAdminDashboardProps {
  session: { user: { name: string; role: string }; school: School };
  activeSchool: School;
  onSelectCampus: (school: School, destination?: string) => void;
}

export function SuperAdminDashboard({ session, activeSchool, onSelectCampus }: SuperAdminDashboardProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<GroupOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.groupOverview()
      .then(({ data }) => setData(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load overview"))
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
          {/* Skeleton Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="skeleton" style={{ width: 200, height: 16, marginBottom: 12 }} />
              <div className="skeleton" style={{ width: 320, height: 32 }} />
            </div>
          </div>
          {/* Skeleton Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-4)" }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton" style={{ height: 110, borderRadius: "var(--radius-xl)" }} />
            ))}
          </div>
          {/* Skeleton Content */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--space-6)" }}>
            <div className="skeleton" style={{ height: 300, borderRadius: "var(--radius-xl)" }} />
            <div className="skeleton" style={{ height: 300, borderRadius: "var(--radius-xl)" }} />
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
  const schools = data?.schools || [];

  return (
    <div className="page">
      {/* Hero Section */}
      <div style={{ marginBottom: "var(--space-8)" }}>
        <p className="body-sm" style={{ color: "var(--color-text-tertiary)", marginBottom: "var(--space-1)" }}>
          {greeting()}, {session.user.name.split(" ")[0]}
        </p>
        <h1 className="heading-2" style={{ marginBottom: "var(--space-2)" }}>
          Platform Overview
        </h1>
        <p className="body" style={{ color: "var(--color-text-secondary)", maxWidth: 600 }}>
          Cross-campus analytics and operational insights for the Montessori group.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="metrics-row" style={{ marginBottom: "var(--space-6)" }}>
        <StatCard
          label="Total Students"
          value={totals?.students?.toLocaleString() || "0"}
          icon={<Users size={18} />}
          change={totals?.activeStudents ? { value: Math.round((totals.activeStudents / totals.students) * 100), label: "active" } : undefined}
        />
        <StatCard
          label="Revenue Collected"
          value={`₹${(totals?.fees || 0).toLocaleString("en-IN")}`}
          icon={<WalletCards size={18} />}
        />
        <StatCard
          label="Active Campuses"
          value={totals?.schools?.toString() || "0"}
          icon={<GraduationCap size={18} />}
        />
        <StatCard
          label="Staff Accounts"
          value={totals?.staff?.toString() || "0"}
          icon={<Users size={18} />}
        />
      </div>

      {/* Content Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--space-6)", marginBottom: "var(--space-6)" }}>
        {/* Campus Portfolio */}
        <Card>
          <div className="card-header">
            <div>
              <h3 className="heading-5">Campus Portfolio</h3>
              <p className="body-sm" style={{ color: "var(--color-text-tertiary)" }}>{schools.length} campuses across the group</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate("/schools")}>
              View all
            </button>
          </div>
          <CardBody>
            {schools.length === 0 ? (
              <EmptyState
                icon={<GraduationCap size={24} />}
                title="No campuses"
                description="No campus data available."
              />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "var(--space-4)" }}>
                {schools.slice(0, 6).map((school) => (
                  <button
                    key={school.id}
                    onClick={() => onSelectCampus(school, "/dashboard")}
                    style={{
                      display: "flex", flexDirection: "column", gap: "var(--space-3)",
                      padding: "var(--space-4)", background: "var(--color-gray-50)",
                      border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-lg)",
                      cursor: "pointer", transition: "all 0.2s", textAlign: "left",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-navy-200)"; e.currentTarget.style.background = "var(--color-surface)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border-subtle)"; e.currentTarget.style.background = "var(--color-gray-50)"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                      <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--color-gray-200)", flexShrink: 0 }}>
                        <img src={GROUP_LOGO} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{school.name}</div>
                        {school.city && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{school.city}</div>}
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-2)" }}>
                      <div style={{ textAlign: "center", padding: "6px 0", background: "var(--color-surface)", borderRadius: "var(--radius-sm)" }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--color-text)" }}>{school.students}</div>
                        <div style={{ fontSize: 9, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Students</div>
                      </div>
                      <div style={{ textAlign: "center", padding: "6px 0", background: "var(--color-surface)", borderRadius: "var(--radius-sm)" }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--color-text)" }}>{school.fees ? `₹${(school.fees / 1000).toFixed(0)}k` : "₹0"}</div>
                        <div style={{ fontSize: 9, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Revenue</div>
                      </div>
                      <div style={{ textAlign: "center", padding: "6px 0", background: "var(--color-surface)", borderRadius: "var(--radius-sm)" }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--color-text)" }}>{school.staff}</div>
                        <div style={{ fontSize: 9, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Staff</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Quick Actions + Activity */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {/* Quick Actions */}
          <Card>
            <div className="card-header">
              <h3 className="heading-5">Quick Actions</h3>
            </div>
            <CardBody>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {[
                  { icon: <GraduationCap size={16} />, label: "Manage Campuses", path: "/schools" },
                  { icon: <Users size={16} />, label: "View All Students", path: "/students" },
                  { icon: <BarChart3 size={16} />, label: "Global Reports", path: "/reports" },
                  { icon: <Settings size={16} />, label: "Platform Settings", path: "/settings" },
                ].map((action) => (
                  <button
                    key={action.path}
                    onClick={() => navigate(action.path)}
                    style={{
                      display: "flex", alignItems: "center", gap: "var(--space-3)",
                      padding: "10px 14px", background: "transparent", border: "1px solid var(--color-border-subtle)",
                      borderRadius: "var(--radius-lg)", cursor: "pointer", fontSize: 13, fontWeight: 500,
                      color: "var(--color-text)", transition: "all 0.15s", textAlign: "left", width: "100%",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-gray-50)"; e.currentTarget.style.borderColor = "var(--color-border-strong)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--color-border-subtle)"; }}
                  >
                    <span style={{ color: "var(--color-text-tertiary)" }}>{action.icon}</span>
                    {action.label}
                    <ArrowUpRight size={14} style={{ marginLeft: "auto", color: "var(--color-text-tertiary)" }} />
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* System Status */}
          <Card>
            <div className="card-header">
              <h3 className="heading-5">System Status</h3>
            </div>
            <CardBody>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                {[
                  { label: "Total Schools", value: totals?.schools || 0, color: "var(--color-primary)" },
                  { label: "Total Students", value: totals?.students || 0, color: "var(--color-success)" },
                  { label: "Active Students", value: totals?.activeStudents || 0, color: "var(--color-info)" },
                  { label: "Certificates", value: totals?.certificates || 0, color: "var(--color-warning)" },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="body-sm">{item.label}</span>
                    <span style={{ fontWeight: 700, fontSize: 15, color: item.color }}>{item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Summary Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)" }}>
        <Card>
          <CardBody>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <div style={{ width: 40, height: 40, borderRadius: "var(--radius-lg)", background: "var(--color-success-light)", display: "grid", placeItems: "center", color: "var(--color-success)" }}>
                <TrendingUp size={18} />
              </div>
              <div>
                <div className="body-sm" style={{ color: "var(--color-text-tertiary)" }}>Active Students</div>
                <div style={{ fontWeight: 700, fontSize: 20 }}>{totals?.activeStudents?.toLocaleString() || "0"}</div>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <div style={{ width: 40, height: 40, borderRadius: "var(--radius-lg)", background: "var(--color-info-light)", display: "grid", placeItems: "center", color: "var(--color-info)" }}>
                <FileBadge2 size={18} />
              </div>
              <div>
                <div className="body-sm" style={{ color: "var(--color-text-tertiary)" }}>Certificates Issued</div>
                <div style={{ fontWeight: 700, fontSize: 20 }}>{totals?.certificates?.toLocaleString() || "0"}</div>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <div style={{ width: 40, height: 40, borderRadius: "var(--radius-lg)", background: "var(--color-warning-light)", display: "grid", placeItems: "center", color: "var(--color-warning)" }}>
                <Calendar size={18} />
              </div>
              <div>
                <div className="body-sm" style={{ color: "var(--color-text-tertiary)" }}>Events Hosted</div>
                <div style={{ fontWeight: 700, fontSize: 20 }}>{totals?.events?.toLocaleString() || "0"}</div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
