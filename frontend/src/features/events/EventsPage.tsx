import React, { useState, useEffect, FormEvent, useRef, useCallback, memo } from "react";
import {
  Plus, Calendar, MapPin, Users, Image, Search, Filter, X,
  ChevronDown, ChevronUp, Edit3, Trash2, Grid, List, Eye,
  Camera, Film, FolderOpen, Clock, CheckCircle2, Archive,
  Download, Upload, HardDrive, FileText, DollarSign, BarChart3,
  CloudUpload, Loader2, AlertCircle, Check
} from "lucide-react";
import { api, Student } from "../../api";
import EmptyState from "../../components/EmptyState";

const EVENT_TYPES = ["academic", "cultural", "sports", "general", "holiday", "other"];
const EVENT_STATUSES = ["draft", "published", "ongoing", "completed", "cancelled"];
const FOLDER_TYPES = ["photos", "videos", "documents", "invitations", "reports", "certificates", "budget", "other"];

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: Calendar },
  { id: "events", label: "Events", icon: Calendar },
  { id: "gallery", label: "Gallery", icon: Image },
  { id: "archive", label: "Archive", icon: Archive },
  { id: "reports", label: "Reports", icon: BarChart3 },
];

export default function EventsPage() {
  const [tab, setTab] = useState("dashboard");
  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">EVENTS</span>
          <h1>Events & Media</h1>
          <p>Manage school events, media gallery, budgets and reports.</p>
        </div>
      </div>
      <nav className="page-tabs">
        {TABS.map(t => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </nav>
      <div className="profile-content">
        {tab === "dashboard" && <EventsDashboard onNavigate={setTab} />}
        {tab === "events" && <EventsList />}
        {tab === "gallery" && <EventsGallery />}
        {tab === "archive" && <EventsArchive />}
        {tab === "reports" && <EventsReports />}
      </div>
    </div>
  );
}

// ─── Events Dashboard ───────────────────────────────────────────────────

function EventsDashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.eventsDashboard()
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <section className="panel" style={{ padding: 24 }}>Loading...</section>;
  if (!data) return <section className="panel" style={{ padding: 24 }}>Failed to load dashboard.</section>;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <section className="panel" style={{ padding: 24 }}>
      <span className="step-label">EVENT OVERVIEW</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginTop: 12 }}>
        <DashCard icon={<Calendar size={20} />} label="Total Events" value={String(data.total || 0)} color="var(--blue, #3b82f6)" onClick={() => onNavigate("events")} />
        <DashCard icon={<Clock size={20} />} label="Upcoming" value={String(data.upcoming || 0)} color="var(--amber, #f59e0b)" />
        <DashCard icon={<CheckCircle2 size={20} />} label="Completed" value={String(data.completed || 0)} color="var(--forest)" />
        <DashCard icon={<FileText size={20} />} label="Drafts" value={String(data.drafts || 0)} color="var(--muted)" />
        <DashCard icon={<HardDrive size={20} />} label="Total Media" value={String(data.totalMedia || 0)} color="var(--purple, #8b5cf6)" onClick={() => onNavigate("gallery")} />
        <DashCard icon={<Camera size={20} />} label="Photos" value={String(data.totalPhotos || 0)} color="var(--forest)" />
        <DashCard icon={<Film size={20} />} label="Videos" value={String(data.totalVideos || 0)} color="var(--coral)" />
        <DashCard icon={<CloudUpload size={20} />} label="Storage Used" value={formatBytes(data.totalStorageBytes || 0)} color="var(--blue, #3b82f6)" />
      </div>

      {data.recentUploads?.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <span className="step-label">RECENT UPLOADS</span>
          <div style={{ marginTop: 12 }}>
            {data.recentUploads.map((m: any, i: number) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                {m.mediaType === "video" ? <Film size={16} color="var(--coral)" /> : <Camera size={16} color="var(--forest)" />}
                <span style={{ flex: 1 }}>{m.filename}</span>
                <small style={{ color: "var(--muted)" }}>{m.mediaType}</small>
                <small style={{ color: "var(--muted)" }}>{formatBytes(m.fileSize || 0)}</small>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function DashCard({ icon, label, value, color, onClick }: { icon: React.ReactNode; label: string; value: string; color: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ padding: 16, background: "var(--cream)", borderRadius: 8, display: "flex", alignItems: "flex-start", gap: 12, cursor: onClick ? "pointer" : "default" }}
    >
      <div style={{ color, marginTop: 2 }}>{icon}</div>
      <div>
        <small style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>{label}</small>
        <strong style={{ fontSize: 22, display: "block", marginTop: 4 }}>{value}</strong>
      </div>
    </div>
  );
}

// ─── Events List ─────────────────────────────────────────────────────────

function EventsList() {
  const [events, setEvents] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);
  const [eventDetail, setEventDetail] = useState<any>(null);
  const [editEvent, setEditEvent] = useState<any>(null);

  const load = () => {
    setLoading(true);
    api.events(typeFilter, statusFilter)
      .then(r => setEvents(r.data))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { void load(); }, [typeFilter, statusFilter]);

  useEffect(() => {
    if (!selectedEvent) { setEventDetail(null); return; }
    api.event(selectedEvent).then(r => setEventDetail(r.data)).catch(() => setEventDetail(null));
  }, [selectedEvent]);

  const filtered = events.filter(e => {
    if (!search) return true;
    return (e.title || "").toLowerCase().includes(search.toLowerCase()) ||
           (e.description || "").toLowerCase().includes(search.toLowerCase());
  });

  async function handleStatusChange(id: number, status: string) {
    try {
      await api.updateEventStatus(id, status);
      void load();
      if (selectedEvent === id) {
        const r = await api.event(id);
        setEventDetail(r.data);
      }
    } catch (err: any) {
      alert(err.message || "Failed");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this event? This cannot be undone.")) return;
    try {
      await api.deleteEvent(id);
      setSelectedEvent(null);
      void load();
    } catch (err: any) {
      alert(err.message || "Failed to delete");
    }
  }

  async function handleUpdateEvent(data: any) {
    if (!editEvent) return;
    try {
      await api.updateEvent(editEvent.id, data);
      setEditEvent(null);
      void load();
      if (selectedEvent === editEvent.id) {
        const r = await api.event(editEvent.id);
        setEventDetail(r.data);
      }
    } catch (err: any) {
      alert(err.message || "Failed to update");
    }
  }

  return (
    <>
      <section className="panel table-panel">
        <div className="table-tools">
          <div className="search-box">
            <Search size={18} />
            <input placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="filter-group">
            <div className="select-wrap small">
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option value="">All types</option>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="select-wrap small">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All statuses</option>
                {EVENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <button className="primary-button" onClick={() => setShowCreate(true)}>
            <Plus size={18} /> Create event
          </button>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Type</th>
                <th>Dates</th>
                <th>Location</th>
                <th>Participants</th>
                <th>Media</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: "2rem" }}>Loading events...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8}><EmptyState icon={<Calendar size={40} />} title="No events found" description="Create your first event to get started" actionLabel="Create event" onAction={() => setShowCreate(true)} /></td></tr>
              ) : (
                filtered.map(ev => (
                  <tr key={ev.id} style={{ cursor: "pointer" }} onClick={() => setSelectedEvent(selectedEvent === ev.id ? null : ev.id)}>
                    <td>
                      <div className="student-cell">
                        <span><Calendar size={18} /></span>
                        <div>
                          <strong>{ev.title}</strong>
                          <small>{ev.description ? ev.description.slice(0, 60) + (ev.description.length > 60 ? "..." : "") : ""}</small>
                        </div>
                      </div>
                    </td>
                    <td><span className="status-badge">{ev.type || "—"}</span></td>
                    <td>
                      {ev.startDate ? new Date(ev.startDate).toLocaleDateString() : "—"}
                      {ev.endDate ? ` – ${new Date(ev.endDate).toLocaleDateString()}` : ""}
                    </td>
                    <td><MapPin size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />{ev.location || "—"}</td>
                    <td><Users size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />{ev.participantCount || 0}</td>
                    <td><Image size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />{ev.mediaCount || 0}</td>
                    <td>
                      <select
                        className={`status-badge ${ev.status === "completed" ? "completed" : ev.status === "cancelled" ? "withdrawn" : ""}`}
                        value={ev.status}
                        onChange={e => { e.stopPropagation(); handleStatusChange(ev.id, e.target.value); }}
                        onClick={e => e.stopPropagation()}
                      >
                        {EVENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="icon-button" onClick={e => { e.stopPropagation(); setEditEvent(ev); }} title="Edit">
                          <Edit3 size={14} />
                        </button>
                        <button className="icon-button" onClick={e => { e.stopPropagation(); handleDelete(ev.id); }} title="Delete">
                          <Trash2 size={14} />
                        </button>
                        {selectedEvent === ev.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedEvent && eventDetail && (
        <EventDetail
          event={eventDetail}
          onRefresh={() => api.event(selectedEvent).then(r => setEventDetail(r.data))}
        />
      )}

      {showCreate && (
        <CreateEventModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); void load(); }} />
      )}

      {editEvent && (
        <EditEventModal event={editEvent} onClose={() => setEditEvent(null)} onUpdated={handleUpdateEvent} />
      )}
    </>
  );
}

// ─── Event Detail ────────────────────────────────────────────────────────

function EventDetail({ event: ev, onRefresh }: { event: any; onRefresh: () => void }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaType, setMediaType] = useState("photo");
  const [mediaCaption, setMediaCaption] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [mediaView, setMediaView] = useState<"grid" | "list">("grid");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [folders, setFolders] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [showBudget, setShowBudget] = useState(false);
  const [budgetCategory, setBudgetCategory] = useState("");
  const [budgetDesc, setBudgetDesc] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetType, setBudgetType] = useState("planned");
  const [previewMedia, setPreviewMedia] = useState<any>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showParticipants) return;
    api.students(studentSearch, "active", 1).then(r => setStudents(r.data)).catch(() => setStudents([]));
  }, [showParticipants, studentSearch]);

  useEffect(() => {
    api.eventFolders(ev.id).then(r => setFolders(r.data)).catch(() => setFolders([]));
    api.eventBudgets(ev.id).then(r => setBudgets(r.data)).catch(() => setBudgets([]));
  }, [ev.id]);

  async function addParticipants() {
    if (selectedStudents.length === 0) return;
    try {
      await api.addEventParticipants(ev.id, selectedStudents);
      setSelectedStudents([]);
      setShowParticipants(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed");
    }
  }

  async function uploadMedia() {
    if (mediaFiles.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const form = new FormData();
      mediaFiles.forEach(f => form.append("files", f));
      form.append("mediaType", mediaType);
      if (mediaCaption) form.append("caption", mediaCaption);
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      await api.uploadEventMedia(ev.id, form);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setTimeout(() => {
        setMediaFiles([]);
        setMediaCaption("");
        setShowMedia(false);
        setUploading(false);
        setUploadProgress(0);
        onRefresh();
      }, 500);
    } catch (err: any) {
      setUploading(false);
      setUploadProgress(0);
      alert(err.message || "Upload failed");
    }
  }

  async function deleteMedia(mediaId: number) {
    if (!confirm("Delete this media file?")) return;
    try {
      await api.deleteEventMedia(mediaId);
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed");
    }
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length) {
      setMediaFiles(Array.from(e.dataTransfer.files));
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) {
      setMediaFiles(Array.from(e.target.files));
    }
  }

  async function addBudget() {
    if (!budgetCategory || !budgetAmount) return;
    try {
      await api.createEventBudget(ev.id, {
        category: budgetCategory,
        description: budgetDesc,
        amount: Number(budgetAmount),
        expenseType: budgetType,
      });
      setBudgetCategory("");
      setBudgetDesc("");
      setBudgetAmount("");
      const r = await api.eventBudgets(ev.id);
      setBudgets(r.data);
      setShowBudget(false);
    } catch (err: any) {
      alert(err.message || "Failed");
    }
  }

  async function deleteBudget(id: number) {
    if (!confirm("Delete this budget item?")) return;
    try {
      await api.deleteEventBudget(id);
      const r = await api.eventBudgets(ev.id);
      setBudgets(r.data);
    } catch (err: any) {
      alert(err.message || "Failed");
    }
  }

  const totalPlanned = budgets.filter((b: any) => b.expenseType === "planned").reduce((s: number, b: any) => s + Number(b.amount), 0);
  const totalActual = budgets.filter((b: any) => b.expenseType === "actual").reduce((s: number, b: any) => s + Number(b.amount), 0);

  return (
    <section className="panel" style={{ padding: 24, marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <span className="step-label">EVENT DETAILS</span>
          <h2 style={{ margin: "8px 0 4px" }}>{ev.title}</h2>
          <p className="muted">{ev.description || "No description"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="secondary-button" onClick={() => setShowParticipants(!showParticipants)}>
            <Users size={16} /> Add participants
          </button>
          <button className="secondary-button" onClick={() => setShowMedia(!showMedia)}>
            <Upload size={16} /> Upload media
          </button>
          <button className="secondary-button" onClick={() => setShowBudget(!showBudget)}>
            <DollarSign size={16} /> Budget
          </button>
        </div>
      </div>

      <div className="form-grid" style={{ gap: 12 }}>
        <InfoCard label="TYPE" value={ev.type || "—"} />
        <InfoCard label="STATUS" value={ev.status || "—"} />
        <InfoCard label="LOCATION" value={ev.location || "—"} icon={<MapPin size={14} />} />
        <InfoCard label="START DATE" value={ev.startDate ? new Date(ev.startDate).toLocaleDateString() : "—"} />
        <InfoCard label="END DATE" value={ev.endDate ? new Date(ev.endDate).toLocaleDateString() : "—"} />
        <InfoCard label="CREATED BY" value={ev.createdByName || "—"} />
        <InfoCard label="PLANNED BUDGET" value={`₹${totalPlanned.toLocaleString()}`} />
        <InfoCard label="ACTUAL EXPENSE" value={`₹${totalActual.toLocaleString()}`} />
      </div>

      {/* Folders */}
      {folders.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <span className="step-label">EVENT FOLDERS</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginTop: 12 }}>
            {folders.map((f: any) => (
              <div key={f.id} style={{ padding: 12, background: "var(--cream)", borderRadius: 8, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <FolderOpen size={18} color="var(--amber, #f59e0b)" />
                <span>{f.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Participants */}
      {ev.participants?.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="step-label">PARTICIPANTS ({ev.participants.length})</span>
            <button className="secondary-button" onClick={() => setShowParticipants(!showParticipants)}>
              <Plus size={14} /> Add more
            </button>
          </div>
          <div className="table-scroll" style={{ marginTop: 8 }}>
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Admission No.</th>
                  <th>Role</th>
                  <th>Attendance</th>
                  <th>Certificate</th>
                </tr>
              </thead>
              <tbody>
                {ev.participants.map((p: any) => (
                  <tr key={p.id || p.studentId}>
                    <td><strong>{p.studentName || `Student #${p.studentId}`}</strong></td>
                    <td>{p.admissionNo || "—"}</td>
                    <td>{p.role || "—"}</td>
                    <td>
                      <span className={`status-badge ${p.attendance === "present" ? "" : p.attendance === "absent" ? "withdrawn" : ""}`}>
                        {p.attendance || "Not marked"}
                      </span>
                    </td>
                    <td>{p.certificateIssued ? "✓ Issued" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Media Gallery */}
      {ev.media?.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="step-label">MEDIA GALLERY ({ev.media.length})</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button className={`icon-button ${mediaView === "grid" ? "active" : ""}`} onClick={() => setMediaView("grid")}><Grid size={16} /></button>
              <button className={`icon-button ${mediaView === "list" ? "active" : ""}`} onClick={() => setMediaView("list")}><List size={16} /></button>
              <button className="secondary-button" onClick={() => setShowMedia(!showMedia)}>
                <Plus size={14} /> Upload
              </button>
            </div>
          </div>

          {mediaView === "grid" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginTop: 12 }}>
              {ev.media.map((m: any) => (
                <div key={m.id} style={{ position: "relative", borderRadius: 8, overflow: "hidden", background: "var(--cream)", aspectRatio: "1", cursor: "pointer" }} onClick={() => setPreviewMedia(m)}>
                  <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", flexDirection: "column", gap: 4 }}>
                    {m.mediaType === "video" ? <Film size={32} color="var(--coral)" /> : <Camera size={32} color="var(--forest)" />}
                    <small style={{ color: "var(--muted)", fontSize: 10, textAlign: "center", padding: "0 4px" }}>{m.filename}</small>
                  </div>
                  <div style={{ position: "absolute", top: 4, right: 4, display: "flex", gap: 4 }}>
                    <a href={api.downloadEventMedia(m.id)} className="icon-button" style={{ background: "rgba(255,255,255,0.9)", padding: 4 }} onClick={e => e.stopPropagation()}>
                      <Download size={12} />
                    </a>
                    <button className="icon-button" style={{ background: "rgba(255,255,255,0.9)", padding: 4 }} onClick={e => { e.stopPropagation(); deleteMedia(m.id); }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {m.caption && (
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.6)", color: "white", padding: "4px 8px", fontSize: 11 }}>
                      {m.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="table-scroll" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr><th>Type</th><th>Filename</th><th>Size</th><th>Caption</th><th>Uploaded</th><th /></tr>
                </thead>
                <tbody>
                  {ev.media.map((m: any) => (
                    <tr key={m.id}>
                      <td><span className="status-badge">{m.mediaType}</span></td>
                      <td>{m.filename}</td>
                      <td>{m.fileSize ? `${(m.fileSize / 1024).toFixed(1)} KB` : "—"}</td>
                      <td>{m.caption || "—"}</td>
                      <td>{m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "—"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <a href={api.downloadEventMedia(m.id)} className="icon-button"><Download size={14} /></a>
                          <button className="icon-button" onClick={() => deleteMedia(m.id)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Participants Panel */}
      {showParticipants && (
        <div style={{ marginTop: 16, padding: 16, background: "var(--cream)", borderRadius: 8 }}>
          <span className="step-label">ADD PARTICIPANTS</span>
          <input
            placeholder="Search students..."
            value={studentSearch}
            onChange={e => setStudentSearch(e.target.value)}
            style={{ width: "100%", marginTop: 8, padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 6 }}
          />
          <div style={{ maxHeight: 200, overflow: "auto", marginTop: 8 }}>
            {students.map(s => (
              <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedStudents.includes(s.id)}
                  onChange={e => {
                    if (e.target.checked) setSelectedStudents([...selectedStudents, s.id]);
                    else setSelectedStudents(selectedStudents.filter(id => id !== s.id));
                  }}
                />
                {s.fullName} — {s.admissionNo}
              </label>
            ))}
          </div>
          <button className="primary-button" style={{ marginTop: 12 }} onClick={addParticipants}>
            Add selected participants
          </button>
        </div>
      )}

      {/* Upload Media Panel */}
      {showMedia && (
        <div style={{ marginTop: 16, padding: 16, background: "var(--cream)", borderRadius: 8 }}>
          <span className="step-label">UPLOAD MEDIA</span>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              marginTop: 12, padding: 24, border: `2px dashed ${dragActive ? "var(--blue)" : "var(--line)"}`,
              borderRadius: 8, textAlign: "center", cursor: "pointer", background: dragActive ? "rgba(59,130,246,0.05)" : "white"
            }}
          >
            <CloudUpload size={32} color={dragActive ? "var(--blue)" : "var(--muted)"} />
            <p style={{ margin: "8px 0 4px", fontWeight: 600 }}>
              {dragActive ? "Drop files here" : "Drag & drop files or click to browse"}
            </p>
            <small style={{ color: "var(--muted)" }}>Supports images, videos, and PDFs up to 25MB each</small>
            <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf" multiple onChange={handleFileSelect} style={{ display: "none" }} />
          </div>

          {mediaFiles.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <small style={{ fontWeight: 600 }}>{mediaFiles.length} file(s) selected</small>
              <div style={{ maxHeight: 120, overflow: "auto", marginTop: 8 }}>
                {mediaFiles.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                    {f.type.startsWith("video") ? <Film size={14} color="var(--coral)" /> : <Camera size={14} color="var(--forest)" />}
                    <span style={{ flex: 1, fontSize: 13 }}>{f.name}</span>
                    <small style={{ color: "var(--muted)" }}>{(f.size / 1024).toFixed(0)} KB</small>
                    <button className="icon-button" onClick={() => setMediaFiles(mediaFiles.filter((_, idx) => idx !== i))}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <label>
              Media Type
              <select value={mediaType} onChange={e => setMediaType(e.target.value)}>
                <option value="photo">Photo</option>
                <option value="video">Video</option>
                <option value="document">Document</option>
                <option value="invitation">Invitation</option>
                <option value="brochure">Brochure</option>
              </select>
            </label>
            <label>
              Caption
              <input value={mediaCaption} onChange={e => setMediaCaption(e.target.value)} placeholder="Optional caption" />
            </label>
          </div>

          {uploading && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <small>Uploading...</small>
                <small>{uploadProgress}%</small>
              </div>
              <div style={{ height: 6, background: "var(--line)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${uploadProgress}%`, background: "var(--blue)", transition: "width 0.2s" }} />
              </div>
            </div>
          )}

          <button className="primary-button" style={{ marginTop: 12 }} disabled={mediaFiles.length === 0 || uploading} onClick={uploadMedia}>
            {uploading ? <><Loader2 size={16} className="spin" /> Uploading...</> : <><Upload size={16} /> Upload {mediaFiles.length} file(s)</>}
          </button>
        </div>
      )}

      {/* Budget Panel */}
      {showBudget && (
        <div style={{ marginTop: 16, padding: 16, background: "var(--cream)", borderRadius: 8 }}>
          <span className="step-label">EVENT BUDGET</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
            <div style={{ padding: 12, background: "white", borderRadius: 8 }}>
              <small style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>PLANNED</small>
              <strong style={{ fontSize: 18, display: "block", marginTop: 4 }}>₹{totalPlanned.toLocaleString()}</strong>
            </div>
            <div style={{ padding: 12, background: "white", borderRadius: 8 }}>
              <small style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>ACTUAL</small>
              <strong style={{ fontSize: 18, display: "block", marginTop: 4, color: "var(--coral)" }}>₹{totalActual.toLocaleString()}</strong>
            </div>
            <div style={{ padding: 12, background: "white", borderRadius: 8 }}>
              <small style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>VARIANCE</small>
              <strong style={{ fontSize: 18, display: "block", marginTop: 4, color: totalPlanned - totalActual >= 0 ? "var(--forest)" : "var(--coral)" }}>
                ₹{(totalPlanned - totalActual).toLocaleString()}
              </strong>
            </div>
          </div>

          {budgets.length > 0 && (
            <div className="table-scroll" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr><th>Category</th><th>Description</th><th>Type</th><th>Amount</th><th /></tr>
                </thead>
                <tbody>
                  {budgets.map((b: any) => (
                    <tr key={b.id}>
                      <td><strong>{b.category}</strong></td>
                      <td>{b.description || "—"}</td>
                      <td><span className={`status-badge ${b.expenseType === "actual" ? "withdrawn" : ""}`}>{b.expenseType}</span></td>
                      <td>₹{Number(b.amount).toLocaleString()}</td>
                      <td>
                        <button className="icon-button" onClick={() => deleteBudget(b.id)}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 8, marginTop: 12, alignItems: "end" }}>
            <label>
              Category *
              <input value={budgetCategory} onChange={e => setBudgetCategory(e.target.value)} placeholder="e.g., Venue, Food" />
            </label>
            <label>
              Description
              <input value={budgetDesc} onChange={e => setBudgetDesc(e.target.value)} placeholder="Optional" />
            </label>
            <label>
              Amount *
              <input type="number" value={budgetAmount} onChange={e => setBudgetAmount(e.target.value)} placeholder="0" />
            </label>
            <label>
              Type
              <select value={budgetType} onChange={e => setBudgetType(e.target.value)}>
                <option value="planned">Planned</option>
                <option value="actual">Actual</option>
              </select>
            </label>
            <button className="primary-button" disabled={!budgetCategory || !budgetAmount} onClick={addBudget}>
              <Plus size={16} /> Add
            </button>
          </div>
        </div>
      )}

      {/* Media Preview Modal */}
      {previewMedia && (
        <div className="modal-overlay" onClick={() => setPreviewMedia(null)}>
          <div style={{ maxWidth: 800, margin: "5vh auto", background: "white", borderRadius: 12, overflow: "hidden" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{previewMedia.filename}</strong>
              <div style={{ display: "flex", gap: 8 }}>
                <a href={api.downloadEventMedia(previewMedia.id)} className="secondary-button" style={{ textDecoration: "none" }}>
                  <Download size={14} /> Download
                </a>
                <button className="icon-button" onClick={() => setPreviewMedia(null)}><X size={18} /></button>
              </div>
            </div>
            <div style={{ padding: 24, display: "grid", placeItems: "center", minHeight: 300, background: "var(--cream)" }}>
              {previewMedia.mediaType === "video" ? (
                <Film size={64} color="var(--coral)" />
              ) : previewMedia.mediaType === "document" ? (
                <FileText size={64} color="var(--blue)" />
              ) : (
                <Camera size={64} color="var(--forest)" />
              )}
            </div>
            {previewMedia.caption && (
              <div style={{ padding: "12px 16px", borderTop: "1px solid var(--line)" }}>
                <small>{previewMedia.caption}</small>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function InfoCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div style={{ padding: 12, background: "var(--cream)", borderRadius: 8 }}>
      <small style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>{label}</small>
      <strong style={{ display: "block", marginTop: 4 }}>{icon} {value}</strong>
    </div>
  );
}

// ─── Create Event Modal ──────────────────────────────────────────────────

function CreateEventModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState(EVENT_TYPES[0]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [budget, setBudget] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.createEvent({
        title, eventType: type, startDate, endDate: endDate || undefined,
        location, description, academicYear: academicYear || undefined,
        budget: budget ? Number(budget) : undefined,
      });
      onCreated();
    } catch (err: any) {
      setError(err.message || "Failed to create event");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="panel" style={{ maxWidth: 520, margin: "8vh auto", padding: 32 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>Create Event</h2>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <label>
            Title *
            <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="Event name" />
          </label>
          <label>
            Type *
            <select value={type} onChange={e => setType(e.target.value)}>
              {EVENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label>
              Start date *
              <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            </label>
            <label>
              End date
              <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </label>
          </div>
          <label>
            Location
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Venue / Room / Ground" />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label>
              Academic Year
              <input value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="2026-27" />
            </label>
            <label>
              Budget (₹)
              <input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="0" />
            </label>
          </div>
          <label>
            Description
            <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ width: "100%", minHeight: 80, marginTop: 8, border: "1px solid var(--line)", borderRadius: 5, padding: 12 }} placeholder="Event details..." />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button" type="submit">Create event</button>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Event Modal ──────────────────────────────────────────────────

function EditEventModal({ event: ev, onClose, onUpdated }: { event: any; onClose: () => void; onUpdated: (data: any) => void }) {
  const [title, setTitle] = useState(ev.title || "");
  const [type, setType] = useState(ev.type || EVENT_TYPES[0]);
  const [startDate, setStartDate] = useState(ev.startDate ? new Date(ev.startDate).toISOString().slice(0, 16) : "");
  const [endDate, setEndDate] = useState(ev.endDate ? new Date(ev.endDate).toISOString().slice(0, 16) : "");
  const [location, setLocation] = useState(ev.location || "");
  const [description, setDescription] = useState(ev.description || "");
  const [academicYear, setAcademicYear] = useState(ev.academicYear || "");
  const [budget, setBudget] = useState(ev.budget ? String(ev.budget) : "");
  const [error, setError] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    onUpdated({
      title, eventType: type, startDate, endDate: endDate || undefined,
      location, description, academicYear: academicYear || undefined,
      budget: budget ? Number(budget) : undefined,
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="panel" style={{ maxWidth: 520, margin: "8vh auto", padding: 32 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>Edit Event</h2>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <label>
            Title *
            <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="Event name" />
          </label>
          <label>
            Type *
            <select value={type} onChange={e => setType(e.target.value)}>
              {EVENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label>
              Start date *
              <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            </label>
            <label>
              End date
              <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </label>
          </div>
          <label>
            Location
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Venue / Room / Ground" />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label>
              Academic Year
              <input value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="2026-27" />
            </label>
            <label>
              Budget (₹)
              <input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="0" />
            </label>
          </div>
          <label>
            Description
            <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ width: "100%", minHeight: 80, marginTop: 8, border: "1px solid var(--line)", borderRadius: 5, padding: 12 }} placeholder="Event details..." />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button" type="submit">Update event</button>
        </form>
      </div>
    </div>
  );
}

// ─── Events Gallery (cross-event) ─────────────────────────────────────

function EventsGallery() {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [previewMedia, setPreviewMedia] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    api.events()
      .then(r => setEvents(r.data))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedEvent) { setMedia([]); return; }
    api.event(selectedEvent).then(r => setMedia(r.data.media || [])).catch(() => setMedia([]));
  }, [selectedEvent]);

  const filteredMedia = media.filter(m => {
    if (!search) return true;
    return (m.filename || "").toLowerCase().includes(search.toLowerCase()) ||
           (m.caption || "").toLowerCase().includes(search.toLowerCase());
  }).filter(m => !typeFilter || m.mediaType === typeFilter);

  const totalSize = filteredMedia.reduce((s, m) => s + (m.fileSize || 0), 0);

  return (
    <section className="panel" style={{ padding: 24 }}>
      <span className="step-label">MEDIA GALLERY</span>
      
      <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", gap: 20, marginTop: 16 }}>
        {/* Event List */}
        <div>
          <div className="search-box" style={{ marginBottom: 12 }}>
            <Search size={16} />
            <input placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ maxHeight: 500, overflow: "auto" }}>
            {events.map(ev => (
              <div
                key={ev.id}
                onClick={() => setSelectedEvent(ev.id)}
                style={{
                  padding: "10px 12px", borderRadius: 6, cursor: "pointer", marginBottom: 4,
                  background: selectedEvent === ev.id ? "var(--blue, #3b82f6)" : "transparent",
                  color: selectedEvent === ev.id ? "white" : "inherit",
                  display: "flex", alignItems: "center", gap: 8
                }}
              >
                <Calendar size={16} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{ev.title}</div>
                  <small style={{ opacity: 0.7 }}>{ev.mediaCount || 0} files</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Media Grid */}
        <div>
          {selectedEvent ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <strong>{filteredMedia.length}</strong> files
                  <small style={{ marginLeft: 8, color: "var(--muted)" }}>
                    ({(totalSize / 1024 / 1024).toFixed(1)} MB)
                  </small>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div className="select-wrap small">
                    <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                      <option value="">All types</option>
                      <option value="photo">Photos</option>
                      <option value="video">Videos</option>
                      <option value="document">Documents</option>
                    </select>
                  </div>
                  <button className={`icon-button ${view === "grid" ? "active" : ""}`} onClick={() => setView("grid")}><Grid size={16} /></button>
                  <button className={`icon-button ${view === "list" ? "active" : ""}`} onClick={() => setView("list")}><List size={16} /></button>
                </div>
              </div>

              {view === "grid" ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
                  {filteredMedia.map(m => (
                    <div key={m.id} style={{ position: "relative", borderRadius: 8, overflow: "hidden", background: "var(--cream)", aspectRatio: "1", cursor: "pointer" }} onClick={() => setPreviewMedia(m)}>
                      <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", flexDirection: "column", gap: 4 }}>
                        {m.mediaType === "video" ? <Film size={28} color="var(--coral)" /> : <Camera size={28} color="var(--forest)" />}
                        <small style={{ color: "var(--muted)", fontSize: 10, textAlign: "center", padding: "0 4px" }}>{m.filename}</small>
                      </div>
                      <div style={{ position: "absolute", top: 4, right: 4 }}>
                        <a href={api.downloadEventMedia(m.id)} className="icon-button" style={{ background: "rgba(255,255,255,0.9)", padding: 4 }} onClick={e => e.stopPropagation()}>
                          <Download size={12} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr><th>Type</th><th>Filename</th><th>Size</th><th>Caption</th><th /></tr>
                    </thead>
                    <tbody>
                      {filteredMedia.map(m => (
                        <tr key={m.id}>
                          <td><span className="status-badge">{m.mediaType}</span></td>
                          <td>{m.filename}</td>
                          <td>{m.fileSize ? `${(m.fileSize / 1024).toFixed(1)} KB` : "—"}</td>
                          <td>{m.caption || "—"}</td>
                          <td>
                            <a href={api.downloadEventMedia(m.id)} className="icon-button"><Download size={14} /></a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)" }}>
              <Image size={48} style={{ opacity: 0.3 }} />
              <p style={{ marginTop: 12 }}>Select an event to view its media</p>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {previewMedia && (
        <div className="modal-overlay" onClick={() => setPreviewMedia(null)}>
          <div style={{ maxWidth: 800, margin: "5vh auto", background: "white", borderRadius: 12, overflow: "hidden" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{previewMedia.filename}</strong>
              <div style={{ display: "flex", gap: 8 }}>
                <a href={api.downloadEventMedia(previewMedia.id)} className="secondary-button" style={{ textDecoration: "none" }}>
                  <Download size={14} /> Download
                </a>
                <button className="icon-button" onClick={() => setPreviewMedia(null)}><X size={18} /></button>
              </div>
            </div>
            <div style={{ padding: 24, display: "grid", placeItems: "center", minHeight: 300, background: "var(--cream)" }}>
              {previewMedia.mediaType === "video" ? (
                <Film size={64} color="var(--coral)" />
              ) : previewMedia.mediaType === "document" ? (
                <FileText size={64} color="var(--blue)" />
              ) : (
                <Camera size={64} color="var(--forest)" />
              )}
            </div>
            {previewMedia.caption && (
              <div style={{ padding: "12px 16px", borderTop: "1px solid var(--line)" }}>
                <small>{previewMedia.caption}</small>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Events Archive ──────────────────────────────────────────────────────

function EventsArchive() {
  const [archive, setArchive] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedYear, setExpandedYear] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  useEffect(() => {
    api.eventsArchive()
      .then(r => setArchive(r.data))
      .catch(() => setArchive([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <section className="panel" style={{ padding: 24 }}>Loading archive...</section>;

  return (
    <>
      <section className="panel" style={{ padding: 24 }}>
        <span className="step-label">EVENT ARCHIVE BY ACADEMIC YEAR</span>
        <p className="muted" style={{ marginTop: 8 }}>Completed events organized by academic year.</p>

        {archive.length === 0 ? (
          <p className="muted" style={{ marginTop: 16 }}>No archived events found.</p>
        ) : (
          <div style={{ marginTop: 16 }}>
            {archive.map((yearData: any) => (
              <div key={yearData.year} style={{ marginBottom: 16, border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
                <div
                  onClick={() => setExpandedYear(expandedYear === yearData.year ? null : yearData.year)}
                  style={{ padding: "12px 16px", background: "var(--cream)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <FolderOpen size={18} />
                    <strong>{yearData.year}</strong>
                    <span style={{ color: "var(--muted)", fontSize: 13 }}>({yearData.events?.length || 0} events)</span>
                  </div>
                  {expandedYear === yearData.year ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
                {expandedYear === yearData.year && yearData.events?.length > 0 && (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Event</th>
                          <th>Type</th>
                          <th>Date</th>
                          <th>Location</th>
                          <th>Participants</th>
                          <th>Media</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {yearData.events.map((ev: any) => (
                          <tr key={ev.id} style={{ cursor: "pointer" }} onClick={() => setSelectedEvent(selectedEvent?.id === ev.id ? null : ev)}>
                            <td><strong>{ev.title}</strong></td>
                            <td><span className="status-badge">{ev.type}</span></td>
                            <td>{ev.startDate ? new Date(ev.startDate).toLocaleDateString() : "—"}</td>
                            <td>{ev.location || "—"}</td>
                            <td><Users size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />{ev.participantCount || 0}</td>
                            <td><Image size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />{ev.mediaCount || 0}</td>
                            <td><Eye size={14} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedEvent && (
        <section className="panel" style={{ padding: 24, marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span className="step-label">ARCHIVED EVENT: {selectedEvent.title}</span>
            <button className="icon-button" onClick={() => setSelectedEvent(null)}><X size={16} /></button>
          </div>
          <div className="form-grid" style={{ gap: 12 }}>
            <InfoCard label="TYPE" value={selectedEvent.type || "—"} />
            <InfoCard label="STATUS" value={selectedEvent.status || "—"} />
            <InfoCard label="LOCATION" value={selectedEvent.location || "—"} />
            <InfoCard label="DATE" value={selectedEvent.startDate ? new Date(selectedEvent.startDate).toLocaleDateString() : "—"} />
            <InfoCard label="PARTICIPANTS" value={String(selectedEvent.participantCount || 0)} />
            <InfoCard label="MEDIA FILES" value={String(selectedEvent.mediaCount || 0)} />
          </div>
        </section>
      )}
    </>
  );
}

// ─── Events Reports ───────────────────────────────────────────────────

function EventsReports() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.eventReports()
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <section className="panel" style={{ padding: 24 }}>Loading reports...</section>;
  if (!data) return <section className="panel" style={{ padding: 24 }}>Failed to load reports.</section>;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <section className="panel" style={{ padding: 24 }}>
      <span className="step-label">EVENTS REPORTS</span>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 16 }}>
        <ReportCard icon={<Calendar size={20} />} label="Total Events" value={String(data.totalEvents || 0)} color="var(--blue)" />
        <ReportCard icon={<Camera size={20} />} label="Total Photos" value={String(data.totalPhotos || 0)} color="var(--forest)" />
        <ReportCard icon={<Film size={20} />} label="Total Videos" value={String(data.totalVideos || 0)} color="var(--coral)" />
        <ReportCard icon={<FileText size={20} />} label="Total Documents" value={String(data.totalDocuments || 0)} color="var(--purple)" />
        <ReportCard icon={<Users size={20} />} label="Total Participants" value={String(data.totalParticipants || 0)} color="var(--amber)" />
        <ReportCard icon={<HardDrive size={20} />} label="Storage Used" value={formatBytes(data.totalStorageBytes || 0)} color="var(--blue)" />
        <ReportCard icon={<DollarSign size={20} />} label="Planned Budget" value={`₹${(data.totalBudgetPlanned || 0).toLocaleString()}`} color="var(--forest)" />
        <ReportCard icon={<DollarSign size={20} />} label="Actual Expense" value={`₹${(data.totalBudgetActual || 0).toLocaleString()}`} color="var(--coral)" />
      </div>

      {/* Events by Type */}
      <div style={{ marginTop: 24 }}>
        <span className="step-label">EVENTS BY TYPE</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginTop: 12 }}>
          {data.byType?.map((t: any) => (
            <div key={t.type} style={{ padding: 16, background: "var(--cream)", borderRadius: 8, textAlign: "center" }}>
              <strong style={{ fontSize: 24, display: "block" }}>{t.count}</strong>
              <small style={{ color: "var(--muted)", textTransform: "capitalize" }}>{t.type}</small>
            </div>
          ))}
        </div>
      </div>

      {/* Storage Breakdown */}
      <div style={{ marginTop: 24 }}>
        <span className="step-label">STORAGE BREAKDOWN</span>
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <Camera size={16} color="var(--forest)" />
            <span style={{ flex: 1 }}>Photos</span>
            <span>{data.totalPhotos || 0} files</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <Film size={16} color="var(--coral)" />
            <span style={{ flex: 1 }}>Videos</span>
            <span>{data.totalVideos || 0} files</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <FileText size={16} color="var(--blue)" />
            <span style={{ flex: 1 }}>Documents</span>
            <span>{data.totalDocuments || 0} files</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReportCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={{ padding: 16, background: "var(--cream)", borderRadius: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ color }}>{icon}</div>
        <small style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>{label}</small>
      </div>
      <strong style={{ fontSize: 20 }}>{value}</strong>
    </div>
  );
}
