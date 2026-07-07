import { useState, useEffect, FormEvent } from "react";
import { Upload, Download, Archive, RotateCcw, Trash2, FileText, Search, Eye, History, Replace, X, AlertTriangle, ChevronDown } from "lucide-react";
import { api, Student } from "../../api";

export default function DocumentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [archivedDocs, setArchivedDocs] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState("");
  const [uploadDocName, setUploadDocName] = useState("");
  const [uploadYear, setUploadYear] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [replaceDocId, setReplaceDocId] = useState<number | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [versionsDocId, setVersionsDocId] = useState<number | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      api.students(studentSearch, "active", 1).then(r => setStudents(r.data)).catch(() => setStudents([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [studentSearch]);

  useEffect(() => {
    api.documentCategories().then(r => {
      setCategories(r.data);
      if (r.data.length > 0 && !uploadCategory) setUploadCategory(r.data[0].code);
    }).catch(() => {});
  }, []);

  const loadDocuments = () => {
    if (!selectedStudent) { setDocuments([]); return; }
    setLoading(true);
    api.studentDocuments(selectedStudent)
      .then(r => setDocuments(r.data))
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadDocuments(); }, [selectedStudent]);

  const loadArchived = () => {
    if (!selectedStudent) return;
    api.studentArchivedDocuments(selectedStudent).then(r => setArchivedDocs(r.data)).catch(() => setArchivedDocs([]));
  };

  useEffect(() => { if (showArchived) loadArchived(); }, [showArchived, selectedStudent]);

  const filtered = documents.filter(d => {
    if (categoryFilter && d.categoryCode !== categoryFilter) return false;
    if (search && !d.documentName?.toLowerCase().includes(search.toLowerCase()) && !d.originalFilename?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file || !selectedStudent) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("categoryCode", uploadCategory);
      form.append("documentName", uploadDocName || file.name);
      if (uploadYear) form.append("academicYear", uploadYear);
      await api.uploadDocument(selectedStudent, form);
      setFile(null);
      setUploadDocName("");
      setShowUpload(false);
      loadDocuments();
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(docId: number, name: string) {
    try {
      const blob = await api.downloadDocument(docId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) { alert(err.message || "Download failed"); }
  }

  async function handlePreview(docId: number, name = "Document preview") {
    try {
      const blob = await api.previewDocument(docId);
      const url = URL.createObjectURL(blob);
      setPreview(current => {
        if (current?.url) URL.revokeObjectURL(current.url);
        return { url, name };
      });
    } catch (err: any) {
      alert(err.message || "Preview failed");
    }
  }

  function closePreview() {
    setPreview(current => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  async function handleArchive(docId: number) {
    if (!confirm("Archive this document? It can be restored later.")) return;
    try {
      await api.archiveDocument(docId);
      loadDocuments();
    } catch (err: any) { alert(err.message || "Archive failed"); }
  }

  async function handleRestore(docId: number) {
    try {
      await api.restoreDocument(docId);
      loadArchived();
      loadDocuments();
    } catch (err: any) { alert(err.message || "Restore failed"); }
  }

  async function handleReplace(docId: number) {
    if (!replaceFile) return;
    try {
      const form = new FormData();
      form.append("file", replaceFile);
      await api.replaceDocument(docId, form);
      setReplaceDocId(null);
      setReplaceFile(null);
      loadDocuments();
    } catch (err: any) { alert(err.message || "Replace failed"); }
  }

  async function handleDelete(docId: number) {
    if (!confirm("Permanently delete this document and ALL its versions? This cannot be undone.")) return;
    try {
      await api.deleteDocument(docId);
      loadDocuments();
    } catch (err: any) { alert(err.message || "Delete failed"); }
  }

  async function loadVersions(docId: number) {
    if (versionsDocId === docId) { setVersionsDocId(null); return; }
    try {
      const r = await api.documentVersions(docId);
      setVersions(r.data);
      setVersionsDocId(docId);
    } catch { setVersions([]); }
  }

  function formatSize(bytes: number) {
    if (!bytes) return "—";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  const getCategoryIcon = (code: string) => {
    const map: Record<string, string> = { photo: "📷", aadhaar: "🪪", birth_certificate: "📜", transfer_certificate: "📋", bonafide: "📄" };
    return map[code] || "📁";
  };

  return (
    <div className="page documents-page">
      <div className="page-title">
        <div>
          <span className="eyebrow">DOCUMENT MANAGEMENT</span>
          <h1>Documents</h1>
          <p>Upload, organize, and manage student documents with full version history.</p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" onClick={() => { setShowArchived(!showArchived); }}>
            <Archive size={17} /> {showArchived ? "Hide" : "Show"} archived
          </button>
          <button className="primary-button" disabled={!selectedStudent} onClick={() => setShowUpload(true)}>
            <Upload size={18} /> Upload document
          </button>
        </div>
      </div>

      {error && <div className="form-error form-banner">{error}</div>}

      <section className="panel">
        <div className="table-tools">
          <div className="search-box">
            <Search size={18} />
            <input placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="filter-group">
            <div className="select-wrap small">
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="">All categories</option>
                {categories.map((c: any) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="doc-student-selector">
          <label className="selector-label">SELECT STUDENT</label>
          <div className="selector-row">
            <input
              className="student-search-input"
              placeholder="Search by name or admission no..."
              value={studentSearch}
              onChange={e => setStudentSearch(e.target.value)}
            />
            <div className="select-wrap" style={{ flex: 1 }}>
              <select value={selectedStudent ?? ""} onChange={e => setSelectedStudent(Number(e.target.value) || null)}>
                <option value="">Choose a student...</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.fullName} — {s.admissionNo} ({s.className})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Active documents */}
        <div className="doc-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Category</th>
                <th>Version</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th>By</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="loading-cell">Loading documents...</td></tr>
              ) : !selectedStudent ? (
                <tr><td colSpan={7} className="empty-cell">Select a student to view documents.</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="empty-cell">No documents found. Upload the first one!</td></tr>
              ) : (
                filtered.map(doc => (
                  <tr key={doc.id} className={doc.isArchived ? "archived" : ""}>
                    <td>
                      <div className="doc-name-cell">
                        <span className="doc-icon">{getCategoryIcon(doc.categoryCode)}</span>
                        <div>
                          <strong>{doc.documentName}</strong>
                          <small title={doc.originalFilename}>{doc.originalFilename}</small>
                        </div>
                      </div>
                    </td>
                    <td><span className="doc-category-badge">{doc.categoryName}</span></td>
                    <td>
                      <button className="version-link" onClick={() => loadVersions(doc.id)}>
                        v{doc.currentVersion || 1} <ChevronDown size={12} />
                      </button>
                    </td>
                    <td>{formatSize(doc.fileSize)}</td>
                    <td>{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : "—"}</td>
                    <td>{doc.uploadedByName || "—"}</td>
                    <td className="actions-cell">
                      <button className="icon-button" title="Preview" onClick={() => handlePreview(doc.id, doc.documentName || doc.originalFilename)}><Eye size={15} /></button>
                      <button className="icon-button" title="Download" onClick={() => handleDownload(doc.id, doc.originalFilename)}><Download size={15} /></button>
                      <button className="icon-button" title="Replace" onClick={() => { setReplaceDocId(doc.id); setReplaceFile(null); }}><Replace size={15} /></button>
                      <button className="icon-button" title="Archive" onClick={() => handleArchive(doc.id)}><Archive size={15} /></button>
                      <button className="icon-button danger" title="Delete permanently" onClick={() => handleDelete(doc.id)}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Version history inline */}
        {versionsDocId && (
          <div className="version-history-panel">
            <div className="version-header">
              <h4><History size={14} /> Version History</h4>
              <button className="icon-button" onClick={() => setVersionsDocId(null)}><X size={14} /></button>
            </div>
            {versions.length === 0 ? (
              <p className="muted">No version history.</p>
            ) : (
              <div className="version-list">
                {versions.map((v: any) => (
                  <div key={v.id} className="version-item">
                    <span className="version-num">v{v.version}</span>
                    <div className="version-info">
                      <strong>{v.filename}</strong>
                      <small>{formatSize(v.fileSize)} · {v.uploadedByName} · {new Date(v.createdAt).toLocaleString()}</small>
                    </div>
                    <button className="icon-button" title="Download this version" onClick={() => handleDownload(v.id, v.filename)}>
                      <Download size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Archived documents section */}
        {showArchived && selectedStudent && (
          <div className="archived-section">
            <h4><Archive size={14} /> Archived Documents ({archivedDocs.length})</h4>
            {archivedDocs.length === 0 ? (
              <p className="muted">No archived documents.</p>
            ) : (
              <div className="archived-list">
                {archivedDocs.map((doc: any) => (
                  <div key={doc.id} className="archived-item">
                    <span className="doc-icon">{getCategoryIcon(doc.categoryCode)}</span>
                    <div>
                      <strong>{doc.documentName}</strong>
                      <small>{doc.categoryName} · {formatSize(doc.fileSize)} · Archived {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString() : ""}</small>
                    </div>
                    <button className="secondary-button" onClick={() => handleRestore(doc.id)}>Restore</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Upload Modal */}
      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="panel modal-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Upload Document</h2>
              <button className="icon-button" onClick={() => setShowUpload(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleUpload} className="modal-form">
              <label className="field">
                <span>Category <b>*</b></span>
                <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} required>
                  {categories.map((c: any) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Document Name <b>*</b></span>
                <input value={uploadDocName} onChange={e => setUploadDocName(e.target.value)} placeholder="e.g. Aadhaar Card Front" required />
              </label>
              <label className="field">
                <span>Academic Year</span>
                <input value={uploadYear} onChange={e => setUploadYear(e.target.value)} placeholder="e.g. 2026–27" />
              </label>
              <label className="field">
                <span>File <b>*</b></span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e => setFile(e.target.files?.[0] || null)} required />
                <small>PDF, JPG, PNG, or WebP. Max 10 MB.</small>
              </label>
              {error && <div className="form-error">{error}</div>}
              <button className="primary-button" disabled={uploading || !file}>
                {uploading ? "Uploading..." : "Upload Document"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Replace Modal */}
      {replaceDocId && (
        <div className="modal-overlay" onClick={() => setReplaceDocId(null)}>
          <div className="panel modal-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Replace Document</h2>
              <button className="icon-button" onClick={() => setReplaceDocId(null)}><X size={18} /></button>
            </div>
            <div className="modal-form">
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>
                This will create a new version. The previous version remains accessible in history.
              </p>
              <label className="field">
                <span>New file <b>*</b></span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e => setReplaceFile(e.target.files?.[0] || null)} required />
              </label>
              <button className="primary-button" disabled={!replaceFile} onClick={() => replaceDocId && handleReplace(replaceDocId)}>
                Replace with new version
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="modal-overlay document-preview-overlay" onClick={closePreview}>
          <div className="document-preview-panel" onClick={event => event.stopPropagation()}>
            <div className="modal-header">
              <div><span className="step-label">DOCUMENT PREVIEW</span><h2>{preview.name}</h2></div>
              <button className="icon-button" aria-label="Close preview" onClick={closePreview}><X size={18} /></button>
            </div>
            <iframe src={preview.url} title={preview.name} />
          </div>
        </div>
      )}
    </div>
  );
}
