import { useState, useEffect, FormEvent } from "react";
import { Plus, Search, Download, Eye, Ban, FileBadge2, ExternalLink, History, X, ChevronDown } from "lucide-react";
import { api, Student } from "../../api";

const CERT_TYPES = [
  { value: "transfer", label: "Transfer Certificate", description: "Official school leaving and transfer record." },
  { value: "study", label: "Study Certificate", description: "Confirmation of current or previous study." },
  { value: "bonafide", label: "Bonafide Certificate", description: "Verified student identity and enrollment." },
  { value: "conduct", label: "Conduct Certificate", description: "Student conduct and character statement." },
  { value: "fee", label: "Fee Certificate", description: "Certified fee payment and dues record." },
  { value: "participation", label: "Participation Certificate", description: "Recognition for event participation." },
  { value: "achievement", label: "Achievement Certificate", description: "Recognition of academic or activity merit." },
];

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [certType, setCertType] = useState("study");
  const [academicYear, setAcademicYear] = useState("");
  const [reason, setReason] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [historyId, setHistoryId] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      api.students(studentSearch, showAllStudents ? "" : "active", 1)
        .then(r => setStudents(r.data))
        .catch(() => setStudents([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [studentSearch, showAllStudents]);

  const load = () => {
    setLoading(true);
    api.listCertificates(typeFilter, statusFilter)
      .then(r => setCertificates(r.data))
      .catch(() => setCertificates([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { void load(); }, [typeFilter, statusFilter]);

  useEffect(() => {
    if (!previewId) {
      setPreviewUrl("");
      return;
    }
    let active = true;
    let objectUrl = "";
    api.previewCertificate(previewId).then(blob => {
      objectUrl = URL.createObjectURL(blob);
      if (active) setPreviewUrl(objectUrl);
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : "Certificate preview failed.");
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [previewId]);

  const filtered = certificates.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.studentName || "").toLowerCase().includes(q) ||
           (c.number || "").toLowerCase().includes(q) ||
           (c.admissionNo || "").toLowerCase().includes(q);
  });

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    if (!selectedStudent) return;
    setGenerating(true);
    setError("");
    try {
      await api.generateCertificate(selectedStudent, {
        certificateType: certType,
        academicYear: academicYear || undefined,
        reason: reason || undefined
      });
      setShowGenerate(false);
      setSelectedStudent(null);
      setReason("");
      setAcademicYear("");
      void load();
    } catch (err: any) {
      setError(err.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(id: number) {
    if (!confirm("Revoke this certificate? This action cannot be undone.")) return;
    try {
      await api.revokeCertificate(id);
      void load();
    } catch (err: any) { alert(err.message || "Revoke failed"); }
  }

  function handleDownload(id: number) {
    api.downloadCertificate(id).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `certificate_${id}.pdf`; a.click();
      URL.revokeObjectURL(url);
    }).catch(err => alert(err.message || "Download failed"));
  }

  async function loadHistory(id: number) {
    if (historyId === id) { setHistoryId(null); return; }
    try {
      const r = await api.certificateHistory(id);
      setHistory(r.data);
      setHistoryId(id);
    } catch { setHistory([]); }
  }

  const certTypeLabel = (type: string) => CERT_TYPES.find(t => t.value === type)?.label || type;

  return (
    <div className="page certificates-page">
      <div className="page-title">
        <div>
          <span className="eyebrow">CERTIFICATE ENGINE</span>
          <h1>Certificates</h1>
          <p>Generate, preview, download and verify student certificates.</p>
        </div>
        <div className="header-actions">
          <button className="primary-button" onClick={() => setShowGenerate(true)}>
            <Plus size={18} /> Generate certificate
          </button>
        </div>
      </div>

      <section className="certificate-template-section">
        <div className="section-heading">
          <div><span className="step-label">CERTIFICATE TEMPLATES</span><h2>Start from an approved format</h2></div>
          <span>{CERT_TYPES.length} templates</span>
        </div>
        <div className="certificate-template-grid">
          {CERT_TYPES.map(template => (
            <article className="certificate-template-card" key={template.value}>
              <div className="template-preview"><FileBadge2 size={30} /></div>
              <div>
                <h3>{template.label}</h3>
                <p>{template.description}</p>
              </div>
              <button className="secondary-button" onClick={() => { setCertType(template.value); setShowGenerate(true); }}>
                Generate <Plus size={16} />
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="panel table-panel">
        <div className="table-tools">
          <div className="search-box">
            <Search size={18} />
            <input placeholder="Search by student, certificate no, or admission no..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="filter-group">
            <div className="select-wrap small">
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option value="">All types</option>
                {CERT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="select-wrap small">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All statuses</option>
                <option value="issued">Issued</option>
                <option value="revoked">Revoked</option>
              </select>
            </div>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Certificate No.</th>
                <th>Student</th>
                <th>Type</th>
                <th>Issued</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="loading-cell">Loading certificates...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="empty-cell">No certificates found.</td></tr>
              ) : (
                filtered.map(cert => (
                  <tr key={cert.id}>
                    <td>
                      <div className="cert-number-cell">
                        <FileBadge2 size={16} />
                        <strong>{cert.number || "—"}</strong>
                      </div>
                    </td>
                    <td>
                      <div>{cert.studentName || "—"}</div>
                      <small>{cert.admissionNo}</small>
                    </td>
                    <td><span className="cert-type-badge">{certTypeLabel(cert.type)}</span></td>
                    <td>{cert.issuedDate ? new Date(cert.issuedDate).toLocaleDateString() : "—"}</td>
                    <td><span className={`cert-status ${cert.status}`}>{cert.status}</span></td>
                    <td className="actions-cell">
                      <button className="icon-button" title="Preview" onClick={() => setPreviewId(cert.id)}>
                        <Eye size={15} />
                      </button>
                      <button className="icon-button" title="Download PDF" onClick={() => handleDownload(cert.id)}>
                        <Download size={15} />
                      </button>
                      {cert.qrCode && (
                        <a href={cert.qrCode} target="_blank" rel="noreferrer" className="icon-button" title="Verify">
                          <ExternalLink size={15} />
                        </a>
                      )}
                      <button className="icon-button" title="History" onClick={() => loadHistory(cert.id)}>
                        <History size={15} />
                      </button>
                      {cert.status === "issued" && (
                        <button className="icon-button danger" title="Revoke" onClick={() => handleRevoke(cert.id)}>
                          <Ban size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Inline history */}
        {historyId && (
          <div className="cert-history-panel">
            <div className="cert-history-header">
              <h4><History size={14} /> Audit Trail</h4>
              <button className="icon-button" onClick={() => setHistoryId(null)}><X size={14} /></button>
            </div>
            {history.length === 0 ? (
              <p className="muted">No history records.</p>
            ) : (
              <div className="cert-history-list">
                {history.map((h: any, i: number) => (
                  <div key={i} className="cert-history-item">
                    <span className="cert-history-action">{h.action?.replace("certificate.", "")}</span>
                    <div>
                      <small>{h.userName || "System"} · {new Date(h.createdAt).toLocaleString()}</small>
                      {h.metadata && <small className="cert-history-meta">{typeof h.metadata === "string" ? h.metadata : JSON.stringify(h.metadata)}</small>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Generate Modal */}
      {showGenerate && (
        <div className="modal-overlay" onClick={() => setShowGenerate(false)}>
          <div className="panel modal-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Generate Certificate</h2>
              <button className="icon-button" onClick={() => setShowGenerate(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleGenerate} className="modal-form">
              <label className="field">
                <span>Certificate Type <b>*</b></span>
                <select value={certType} onChange={e => setCertType(e.target.value)} required>
                  {CERT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Student <b>*</b></span>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <input
                    placeholder="Search students..."
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 6, fontSize: 13 }}
                  />
                  <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                    <input type="checkbox" checked={showAllStudents} onChange={e => setShowAllStudents(e.target.checked)} />
                    All statuses
                  </label>
                </div>
                <select value={selectedStudent ?? ""} onChange={e => setSelectedStudent(Number(e.target.value) || null)} required>
                  <option value="">Select student...</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.fullName} — {s.admissionNo} ({s.className}) [{s.status}]</option>
                  ))}
                </select>
                {certType === "transfer" && (
                  <small style={{ color: "#d97706" }}>TC requires student to be Withdrawn, Alumni, or Suspended.</small>
                )}
              </label>
              <label className="field">
                <span>Academic Year</span>
                <input value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="e.g. 2026–27" />
              </label>
              <label className="field">
                <span>Reason / Purpose</span>
                <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Bank account opening, higher studies admission" />
              </label>
              {error && <div className="form-error">{error}</div>}
              <button className="primary-button" disabled={generating || !selectedStudent}>
                {generating ? "Generating..." : "Generate Certificate"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal (iframe) */}
      {previewId && (
        <div className="modal-overlay" onClick={() => setPreviewId(null)}>
          <div className="cert-preview-panel" onClick={e => e.stopPropagation()}>
            <div className="cert-preview-header">
              <h3>Certificate Preview</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="secondary-button" onClick={() => handleDownload(previewId)}>
                  <Download size={15} /> Download PDF
                </button>
                <button className="icon-button" onClick={() => setPreviewId(null)}><X size={18} /></button>
              </div>
            </div>
            <iframe
              src={previewUrl || "about:blank"}
              title="Certificate Preview"
              style={{ width: "100%", flex: 1, border: "none", minHeight: 500 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
