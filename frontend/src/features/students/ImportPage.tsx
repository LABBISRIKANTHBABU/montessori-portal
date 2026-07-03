import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeft, Upload, FileBadge2, Check, AlertTriangle, Download, Eye, RotateCcw, Trash2, FileText, History, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "../../api";

type WizardStep = "upload" | "mapping" | "preview" | "approve" | "summary";
type RowStatus = "valid" | "error" | "duplicate";

const CANONICAL_FIELDS = [
  { key: "admissionNo", label: "Admission No", required: true },
  { key: "fullName", label: "Student Name", required: true },
  { key: "gender", label: "Gender" },
  { key: "dateOfBirth", label: "Date of Birth", required: true },
  { key: "dateOfAdmission", label: "Date of Admission", required: true },
  { key: "academicYear", label: "Academic Year", required: true },
  { key: "board", label: "Board", required: true },
  { key: "classAdmitted", label: "Class Admitted", required: true },
  { key: "sectionName", label: "Section" },
  { key: "residenceAddress", label: "Residence Address", required: true },
  { key: "studentAadhaarNo", label: "Student Aadhaar No" },
  { key: "penNo", label: "PEN No" },
  { key: "apaarId", label: "AAPAR ID" },
  { key: "nationality", label: "Nationality" },
  { key: "religion", label: "Religion" },
  { key: "caste", label: "Caste" },
  { key: "subCaste", label: "Sub Caste" },
  { key: "motherTongue", label: "Mother Tongue" },
  { key: "fatherName", label: "Father Name" },
  { key: "fatherAadhaarNo", label: "Father Aadhaar No" },
  { key: "fatherMobileNumber", label: "Father Mobile" },
  { key: "fatherEmail", label: "Father Email" },
  { key: "fatherQualification", label: "Father Qualification" },
  { key: "fatherOccupation", label: "Father Occupation" },
  { key: "motherName", label: "Mother Name" },
  { key: "motherAadhaarNo", label: "Mother Aadhaar No" },
  { key: "motherMobileNumber", label: "Mother Mobile" },
  { key: "motherEmail", label: "Mother Email" },
  { key: "motherQualification", label: "Mother Qualification" },
  { key: "motherOccupation", label: "Mother Occupation" },
  { key: "motherBankAccountNo", label: "Mother Bank Account" },
  { key: "bankIfscCode", label: "Bank IFSC Code" },
  { key: "previousSchoolClass", label: "Previous School & Class" },
  { key: "previousTcNo", label: "TC Number" },
  { key: "classLeaving", label: "Class Leaving" },
  { key: "dateOfLeaving", label: "Date of Leaving" },
  { key: "leavingTcNo", label: "Leaving TC No" },
  { key: "tcTakenDate", label: "TC Taken Date" },
  { key: "studentEmail", label: "Student Email" },
];

const ALIASES: Record<string, string> = {
  idno: "admissionNo", admissionno: "admissionNo", nameofthepupil: "fullName", name: "fullName",
  studentaadhaarno: "studentAadhaarNo", penno: "penNo", aaparid: "apaarId",
  fathername: "fatherName", fatheraadhaarno: "fatherAadhaarNo", fathermobilenumber: "fatherMobileNumber",
  mailid: "studentEmail", mothername: "motherName", motheraadharno: "motherAadhaarNo",
  mothermobileno: "motherMobileNumber", motherbankaccountno: "motherBankAccountNo", bankifsccode: "bankIfscCode",
  residenceaddress: "residenceAddress", fatherqualification: "fatherQualification", fatheroccupation: "fatherOccupation",
  fathermailid: "fatherEmail", motherqualification: "motherQualification", motheroccupation: "motherOccupation",
  mothermailid: "motherEmail", previousschoolclass: "previousSchoolClass", tcnumber: "previousTcNo",
  dateofadmission: "dateOfAdmission", dateofbirth: "dateOfBirth", nationality: "nationality",
  religion: "religion", caste: "caste", subcaste: "subCaste", mothertongue: "motherTongue",
  classadmitted: "classAdmitted", classleaving: "classLeaving", dateofleaving: "dateOfLeaving",
  leavingtcno: "leavingTcNo", tctakendate: "tcTakenDate", academicyear: "academicYear",
  board: "board", gender: "gender", section: "sectionName", sectionname: "sectionName",
};

function autoMapHeaders(rawHeaders: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const h of rawHeaders) {
    const cleaned = h.toLowerCase().replace(/[^a-z0-9]/g, "");
    const canonical = ALIASES[cleaned];
    if (canonical) mapping[h] = canonical;
  }
  return mapping;
}

export default function ImportPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>("upload");
  const [batches, setBatches] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [headerMapping, setHeaderMapping] = useState<Record<string, string>>({});
  const [showHistory, setShowHistory] = useState(false);

  const loadBatches = () => api.imports().then(r => setBatches(r.data)).catch(() => {});
  useEffect(() => { void loadBatches(); }, []);

  function detectHeaders(file: File) {
    return new Promise<string[]>((resolve) => {
      if (file.name.toLowerCase().endsWith(".csv")) {
        const reader = new FileReader();
        reader.onload = () => {
          const text = String(reader.result || "");
          const firstLine = text.split("\n")[0] || "";
          resolve(firstLine.split(",").map(h => h.replace(/^"|"$/g, "").trim()));
        };
        reader.readAsText(file);
      } else {
        import("exceljs").then(({ default: ExcelJS }) => {
          const reader = new FileReader();
          reader.onload = async () => {
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.load(reader.result as ArrayBuffer);
            const sheet = wb.worksheets[0];
            const headers: string[] = [];
            sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
              headers[col - 1] = String(cell.value || "").trim();
            });
            resolve(headers);
          };
          reader.readAsArrayBuffer(file);
        });
      }
    });
  }

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = (new FormData(e.currentTarget).get("file") as File);
    if (!file?.size) return;
    setBusy(true); setError("");
    try {
      setRawFile(file);
      const headers = await detectHeaders(file);
      setRawHeaders(headers);
      setHeaderMapping(autoMapHeaders(headers));
      setStep("mapping");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read file headers");
    } finally {
      setBusy(false);
    }
  }

  async function handleValidateAndStage() {
    if (!rawFile) return;
    setBusy(true); setError("");
    try {
      const r = await api.uploadImport(rawFile);
      setSelected(r.data);
      setStep("preview");
      await loadBatches();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    if (!selected) return;
    setBusy(true); setError("");
    try {
      const r = await api.approveImport(selected.id);
      setSelected(r.data);
      setStep("summary");
      await loadBatches();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!selected) return;
    if (!confirm("Reject this batch? Valid rows will not be imported.")) return;
    setBusy(true); setError("");
    try {
      const r = await api.rejectImport(selected.id);
      setSelected(r.data);
      await loadBatches();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rejection failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRollback() {
    if (!selected) return;
    if (!confirm("Rollback this import? All imported students will be soft-deleted and their admissions revoked.")) return;
    setBusy(true); setError("");
    try {
      const r = await api.rollbackImport(selected.id);
      setSelected(r.data);
      await loadBatches();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rollback failed");
    } finally {
      setBusy(false);
    }
  }

  function downloadErrors(format: "csv" | "html") {
    if (!selected) return;
    if (format === "html") {
      window.open(api.viewErrorReport(selected.id), "_blank");
    } else {
      api.downloadImportErrors(selected.id).then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `import-${selected.id}-errors.csv`; a.click();
        URL.revokeObjectURL(url);
      });
    }
  }

  async function loadBatchDetail(batchId: string) {
    try {
      const r = await api.importBatch(batchId);
      setSelected(r.data);
      setStep("preview");
    } catch { /* ignore */ }
  }

  function resetWizard() {
    setStep("upload");
    setSelected(null);
    setRawFile(null);
    setRawHeaders([]);
    setHeaderMapping({});
    setError("");
  }

  const statusCounts = selected ? {
    total: selected.total_rows || 0,
    valid: selected.valid_rows || 0,
    errors: selected.error_rows || 0,
    duplicates: selected.duplicate_rows || 0,
    imported: selected.imported_rows || 0,
  } : null;

  const steps: { id: WizardStep; label: string; icon: any }[] = [
    { id: "upload", label: "Upload", icon: Upload },
    { id: "mapping", label: "Map Headers", icon: FileText },
    { id: "preview", label: "Preview", icon: Eye },
    { id: "approve", label: "Approve", icon: Check },
    { id: "summary", label: "Summary", icon: FileBadge2 },
  ];

  const currentStepIdx = steps.findIndex(s => s.id === step);

  return (
    <div className="page import-page">
      <button className="back-button" onClick={() => navigate("/students")}>
        <ArrowRight size={16} style={{ transform: "rotate(180deg)" }} /> Student directory
      </button>
      <div className="page-title">
        <div>
          <span className="eyebrow">CONTROLLED DATA INTAKE</span>
          <h1>Import with confidence.</h1>
          <p>Validate every row before it becomes a student record.</p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" onClick={() => setShowHistory(!showHistory)}>
            <History size={17} /> {showHistory ? "Hide" : "Show"} history
          </button>
          {step !== "upload" && (
            <button className="secondary-button" onClick={resetWizard}>
              New import
            </button>
          )}
        </div>
      </div>

      {error && <div className="form-error form-banner">{error}</div>}

      {/* Wizard Progress */}
      <nav className="import-wizard-nav">
        {steps.map((s, i) => (
          <div key={s.id} className={`wizard-step ${step === s.id ? "active" : i < currentStepIdx ? "completed" : ""}`}>
            <span className="step-icon">{i < currentStepIdx ? <Check size={14} /> : <s.icon size={15} />}</span>
            <strong>{s.label}</strong>
          </div>
        ))}
      </nav>

      {/* Import History Panel */}
      {showHistory && (
        <section className="panel import-history-panel">
          <span className="step-label">IMPORT HISTORY</span>
          {batches.length === 0 ? (
            <p className="muted">No import batches yet.</p>
          ) : (
            <div className="history-list">
              {batches.map(batch => (
                <button key={batch.id} className="history-item" onClick={() => loadBatchDetail(batch.id)}>
                  <div className="history-info">
                    <strong>{batch.filename}</strong>
                    <small>{batch.sourceType} · {batch.totalRows} rows · {batch.createdAt}</small>
                  </div>
                  <div className="history-meta">
                    <span className={`import-status ${batch.status}`}>{batch.status.replace(/_/g, " ")}</span>
                    {batch.status === "completed" && (
                      <button className="icon-button danger" title="Rollback this import" onClick={e => { e.stopPropagation(); setSelected(batch); handleRollback(); }}>
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="import-layout">
        <div>
          {/* STEP 1: Upload */}
          {step === "upload" && (
            <>
              <article className="panel import-drop">
                <Upload size={28} />
                <h3>Upload student workbook</h3>
                <p>Compatible with the legacy Excel headers. XLSX or CSV · maximum 15 MB.</p>
                <div style={{ margin: "14px 0", fontSize: "11px", display: "flex", gap: "10px", justifyContent: "center" }}>
                  <a href="/api/imports/template.xlsx" target="_blank" rel="noreferrer" style={{ color: "var(--forest-2)", fontWeight: "bold", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <Download size={14} /> Download Template
                  </a>
                </div>
                <form onSubmit={handleUpload}>
                  <input name="file" type="file" accept=".xlsx,.csv" required />
                  <button className="primary-button" disabled={busy}>{busy ? "Reading headers…" : "Upload & map headers"}</button>
                </form>
              </article>
              <article className="panel legacy-card">
                <div>
                  <span className="step-label">LEGACY DATABASE</span>
                  <h3>Stage existing student_details</h3>
                  <p>Copies this campus into review staging without changing legacy records.</p>
                </div>
                <button className="secondary-button" onClick={async () => {
                  setBusy(true); setError("");
                  try {
                    const r = await api.stageLegacy();
                    setSelected(r.data);
                    setStep("preview");
                    await loadBatches();
                  } catch (e) { setError(e instanceof Error ? e.message : "Staging failed"); }
                  finally { setBusy(false); }
                }} disabled={busy}>Stage legacy data</button>
              </article>
            </>
          )}

          {/* STEP 2: Header Mapping */}
          {step === "mapping" && (
            <article className="panel import-mapping">
              <div className="panel-head">
                <div>
                  <span className="step-label">HEADER MAPPING</span>
                  <h3>Map spreadsheet columns to student fields</h3>
                  <p>Auto-detected mappings are shown below. Adjust any mismatches before validating.</p>
                </div>
              </div>
              <div className="mapping-grid">
                <div className="mapping-header">
                  <span>Spreadsheet Column</span>
                  <span>Maps To</span>
                  <span>Required</span>
                </div>
                {rawHeaders.filter(h => h.trim()).map(header => {
                  const mapped = headerMapping[header] || "";
                  const canonical = CANONICAL_FIELDS.find(f => f.key === mapped);
                  return (
                    <div key={header} className={`mapping-row ${mapped ? "mapped" : "unmapped"}`}>
                      <span className="source-col">{header}</span>
                      <select
                        value={mapped}
                        onChange={e => setHeaderMapping(prev => ({ ...prev, [header]: e.target.value }))}
                      >
                        <option value="">— Skip this column —</option>
                        {CANONICAL_FIELDS.map(f => (
                          <option key={f.key} value={f.key}>{f.label}{f.required ? " *" : ""}</option>
                        ))}
                      </select>
                      <span className="required-indicator">{canonical?.required ? "Required" : "Optional"}</span>
                    </div>
                  );
                })}
              </div>
              <div className="wizard-footer">
                <button className="secondary-button" onClick={() => setStep("upload")}><ArrowLeft size={17} /> Back</button>
                <button className="primary-button" onClick={handleValidateAndStage} disabled={busy}>
                  {busy ? "Validating…" : "Validate & Stage"} <ArrowRight size={17} />
                </button>
              </div>
            </article>
          )}

          {/* STEP 3: Preview & Validation */}
          {step === "preview" && selected && (
            <article className="panel import-review">
              <div className="panel-head">
                <div>
                  <span className="step-label">BATCH REVIEW</span>
                  <h3>{selected.original_filename || selected.filename}</h3>
                </div>
                <span className={`import-status ${selected.status}`}>{selected.status.replace(/_/g, " ")}</span>
              </div>

              <div className="import-metrics">
                <span><strong>{statusCounts?.total}</strong>Total</span>
                <span className="good"><strong>{statusCounts?.valid}</strong>Valid</span>
                <span className="bad"><strong>{statusCounts?.errors}</strong>Errors</span>
                <span className="warn"><strong>{statusCounts?.duplicates}</strong>Duplicates</span>
              </div>

              {/* Row filter tabs */}
              <ImportRowList rows={selected.rows || []} />

              <div className="review-actions">
                <div className="review-actions-left">
                  {(statusCounts?.errors || 0) + (statusCounts?.duplicates || 0) > 0 && (
                    <div className="dropdown-group">
                      <button className="secondary-button" onClick={() => downloadErrors("csv")}>
                        <Download size={15} /> Error CSV
                      </button>
                      <button className="secondary-button" onClick={() => downloadErrors("html")}>
                        <FileText size={15} /> Styled Report
                      </button>
                    </div>
                  )}
                  {["completed", "completed_with_errors"].includes(selected.status) && (
                    <button className="danger-button" onClick={handleRollback} disabled={busy}>
                      <RotateCcw size={15} /> Rollback
                    </button>
                  )}
                </div>
                <div className="review-actions-right">
                  {["ready", "approved"].includes(selected.status) && (
                    <>
                      <button className="secondary-button" onClick={handleReject} disabled={busy}>Reject batch</button>
                      <button className="primary-button" disabled={busy || !(statusCounts?.valid)} onClick={() => { setStep("approve"); }}>
                        Continue to Approve <ArrowRight size={17} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          )}

          {/* STEP 4: Final Approval Confirmation */}
          {step === "approve" && selected && (
            <article className="panel import-approve">
              <div className="panel-head">
                <div>
                  <span className="step-label">FINAL APPROVAL</span>
                  <h3>Confirm import of {statusCounts?.valid} student records</h3>
                </div>
              </div>
              <div className="approve-summary">
                <div className="approve-metrics">
                  <div className="metric good"><strong>{statusCounts?.valid}</strong><small>Students to import</small></div>
                  <div className="metric bad"><strong>{statusCounts?.errors}</strong><small>Rows with errors</small></div>
                  <div className="metric warn"><strong>{statusCounts?.duplicates}</strong><small>Duplicate rows</small></div>
                </div>
                <div className="approve-warning">
                  <AlertTriangle size={20} />
                  <div>
                    <strong>This action cannot be undone easily.</strong>
                    <p>Each valid row will create a student record, admission entry, and guardian records. You can rollback completed imports from the history panel.</p>
                  </div>
                </div>
              </div>
              <div className="wizard-footer">
                <button className="secondary-button" onClick={() => setStep("preview")}><ArrowLeft size={17} /> Back to review</button>
                <button className="primary-button" onClick={handleApprove} disabled={busy}>
                  {busy ? "Importing…" : `Approve & Import ${statusCounts?.valid} Records`}
                </button>
              </div>
            </article>
          )}

          {/* STEP 5: Summary */}
          {step === "summary" && selected && (
            <article className="panel import-summary">
              <div className="summary-header">
                <div className="summary-icon"><Check size={32} /></div>
                <h2>Import Complete</h2>
                <p>{selected.original_filename || selected.filename}</p>
              </div>
              <div className="import-metrics">
                <span><strong>{statusCounts?.total}</strong>Total</span>
                <span className="good"><strong>{statusCounts?.imported}</strong>Imported</span>
                <span className="bad"><strong>{statusCounts?.errors}</strong>Failed</span>
              </div>
              <div className="summary-actions">
                <button className="primary-button" onClick={() => navigate("/students")}>View Student Directory</button>
                <button className="secondary-button" onClick={resetWizard}>Import Another File</button>
              </div>
            </article>
          )}
        </div>

        {/* Sidebar: empty state or quick info */}
        {step === "upload" && !showHistory && (
          <article className="panel import-empty">
            <FileBadge2 size={36} />
            <h3>How it works</h3>
            <div className="how-it-works">
              <div className="hiw-step"><span className="hiw-num">1</span><div><strong>Upload</strong><p>Choose an XLSX or CSV file with student data.</p></div></div>
              <div className="hiw-step"><span className="hiw-num">2</span><div><strong>Map Headers</strong><p>Match spreadsheet columns to student fields.</p></div></div>
              <div className="hiw-step"><span className="hiw-num">3</span><div><strong>Validate</strong><p>Review errors, duplicates, and valid rows.</p></div></div>
              <div className="hiw-step"><span className="hiw-num">4</span><div><strong>Approve</strong><p>Confirm and create student records.</p></div></div>
              <div className="hiw-step"><span className="hiw-num">5</span><div><strong>Audit</strong><p>Everything is logged. Rollback if needed.</p></div></div>
            </div>
          </article>
        )}
      </section>
    </div>
  );
}

function ImportRowList({ rows }: { rows: any[] }) {
  const [filter, setFilter] = useState<RowStatus | "all">("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const filtered = filter === "all" ? rows : rows.filter(r => r.status === filter);
  const counts = { valid: rows.filter(r => r.status === "valid").length, error: rows.filter(r => r.status === "error").length, duplicate: rows.filter(r => r.status === "duplicate").length };

  return (
    <div className="import-rows">
      <div className="row-filter-tabs">
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All ({rows.length})</button>
        <button className={filter === "valid" ? "active good" : ""} onClick={() => setFilter("valid")}>Valid ({counts.valid})</button>
        <button className={filter === "error" ? "active bad" : ""} onClick={() => setFilter("error")}>Errors ({counts.error})</button>
        <button className={filter === "duplicate" ? "active warn" : ""} onClick={() => setFilter("duplicate")}>Duplicates ({counts.duplicate})</button>
      </div>
      <div className="review-rows">
        {filtered.slice(0, 200).map((row: any) => (
          <div key={row.id} className={`review-row ${row.status}`} onClick={() => setExpanded(expanded === row.id ? null : row.id)}>
            <div className="row-summary">
              <span className="row-num">#{row.sourceRowNumber}</span>
              <strong>{row.normalized?.fullName || "Unnamed student"}</strong>
              <span className="row-admission">{row.normalized?.admissionNo || "—"}</span>
              <span className={`import-status ${row.status}`}>{row.status}</span>
              {expanded === row.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
            {expanded === row.id && (
              <div className="row-detail">
                {row.errors?.length > 0 && (
                  <div className="row-errors">
                    {row.errors.map((e: string, i: number) => <div key={i} className="err-msg"><AlertTriangle size={12} /> {e}</div>)}
                  </div>
                )}
                <div className="row-data">
                  {Object.entries(row.normalized || {}).filter(([_, v]) => v).map(([k, v]) => (
                    <span key={k}><strong>{k}:</strong> {String(v)}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length > 200 && <p className="muted" style={{ textAlign: "center", padding: "12px" }}>Showing first 200 of {filtered.length} rows.</p>}
      </div>
    </div>
  );
}
