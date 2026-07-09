import React, { useState, useEffect, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Upload, ArrowRight, Download, Filter, MoreHorizontal, Users, ArrowUpDown } from "lucide-react";
import { api, Student } from "../../api";
import { useDebounce } from "../../hooks/useDebounce";
import Pagination from "../../components/Pagination";
import EmptyState from "../../components/EmptyState";

export default function StudentsPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [sortBy, setSortBy] = useState("admissionNo");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [academics, setAcademics] = useState<{ academicYears: string[]; classes: string[] }>({ academicYears: [], classes: [] });
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => { api.academicSetup().then(result => setAcademics({ academicYears: result.data.academicYears, classes: result.data.classes })).catch(() => undefined); }, []);
  useEffect(() => { setPage(1); }, [statusFilter, academicYear, classFilter, sectionFilter, sortBy, sortDir, debouncedSearch]);

  const load = () => {
    setLoading(true);
    api.students(debouncedSearch, statusFilter, page, {
      limit: pageSize,
      academicYear,
      className: classFilter,
      sectionName: sectionFilter,
      sortBy,
      sortDir,
    }).then(r => { setStudents(r.data); setTotal(r.total); }).catch(() => { setStudents([]); setTotal(0); }).finally(() => setLoading(false));
  };

  useEffect(() => { void load(); }, [debouncedSearch, statusFilter, academicYear, classFilter, sectionFilter, sortBy, sortDir, page]);

  function toggleSort(field: string) {
    if (sortBy === field) setSortDir(prev => prev === "asc" ? "desc" : "asc");
    else { setSortBy(field); setSortDir("asc"); }
  }

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.length === students.length) setSelectedIds([]);
    else setSelectedIds(students.map(s => s.id));
  }, [students, selectedIds]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  async function executeBulk() {
    if (!bulkAction || selectedIds.length === 0) return;
    setBulkLoading(true);
    try {
      if (bulkAction === "promote") {
        if (!bulkValue) { alert("Enter target class."); setBulkLoading(false); return; }
        await api.bulkPromote(selectedIds, bulkValue);
      } else if (bulkAction === "assign-class") {
        if (!bulkValue) { alert("Enter class name."); setBulkLoading(false); return; }
        await api.bulkAssign(selectedIds, "class", bulkValue);
      } else if (bulkAction === "assign-section") {
        if (!bulkValue) { alert("Enter section name."); setBulkLoading(false); return; }
        await api.bulkAssign(selectedIds, "section", bulkValue);
      } else if (bulkAction === "graduate-alumni") {
        if (!confirm("Move the selected active Grade 10 students to Alumni? Non-Grade 10 records will be skipped.")) return;
        const result = await api.bulkGraduateGradeTen(selectedIds);
        alert(`${result.data.graduated} student(s) moved to Alumni. ${result.data.skipped} skipped.`);
      }
      setSelectedIds([]);
      setBulkAction("");
      setBulkValue("");
      void load();
    } catch (e: any) {
      alert(e.message || "Bulk action failed.");
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleExport(format: "csv" | "xlsx") {
    try {
      const blob = await api.exportStudents(search, statusFilter, format);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `students.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Export failed.");
    }
  }

  const hasSelection = selectedIds.length > 0;
  const filtersApplied = Boolean(statusFilter || academicYear || classFilter || sectionFilter || debouncedSearch);

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">STUDENT DIRECTORY</span>
          <h1>Every learner, one clear record.</h1>
          <p>Search, review and manage students for the current campus.</p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" onClick={() => navigate("/students/imports")}>
            <Upload size={17} /> Bulk import
          </button>
          <button className="primary-button" onClick={() => navigate("/students/new")}>
            <Plus size={18} /> Add student
          </button>
        </div>
      </div>
      
      <section className="panel table-panel">
        <div className="directory-summary-strip">
          <div>
            <strong>{total.toLocaleString("en-IN")}</strong>
            <span>{filtersApplied ? "matching student records" : "student records in this school"}</span>
          </div>
          <small>{filtersApplied ? "Filters are active. Clear filters to see the full school directory." : "Showing all statuses and all years by default."}</small>
        </div>
        <div className="table-tools">
          <div className="search-box">
            <Search size={18} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or admission number" />
          </div>
          <div className="filter-group">
            <div className="select-wrap small">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="dropped">Dropped</option>
                <option value="transferred">Transferred</option>
                <option value="alumni">Alumni</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <button className="icon-button" title="More filters"><Filter size={18} /></button>
            <div className="select-wrap small">
              <select value={academicYear} onChange={e => setAcademicYear(e.target.value)}>
                <option value="">All years</option>
                {academics.academicYears.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>
            <div className="select-wrap small">
              <select value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                <option value="">All classes</option>
                {academics.classes.map(className => <option key={className} value={className}>{className}</option>)}
              </select>
            </div>
            <input className="section-filter-input" value={sectionFilter} onChange={e => setSectionFilter(e.target.value)} placeholder="Section" />
            <div className="dropdown-wrap">
              <button className="icon-button" title="Export" onClick={() => handleExport("csv")}><Download size={18} /></button>
            </div>
          </div>
        </div>

        {hasSelection && (
          <div className="bulk-actions">
            <span>{selectedIds.length} student{selectedIds.length !== 1 ? "s" : ""} selected</span>
            <div className="bulk-controls">
              <div className="select-wrap small">
                <select value={bulkAction} onChange={e => { setBulkAction(e.target.value); setBulkValue(""); }}>
                  <option value="">Choose action...</option>
                  <option value="promote">Promote to class</option>
                  <option value="assign-class">Assign class</option>
                  <option value="assign-section">Assign section</option>
                  <option value="graduate-alumni">Complete Grade 10 → Alumni</option>
                </select>
              </div>
              {(bulkAction === "promote" || bulkAction === "assign-class" || bulkAction === "assign-section") && (
                <input value={bulkValue} onChange={e => setBulkValue(e.target.value)} placeholder={bulkAction === "assign-section" ? "Section name" : "Class name"} className="bulk-value-input" />
              )}
              <button className="primary-button small" disabled={bulkLoading || !bulkAction} onClick={executeBulk}>
                {bulkLoading ? "Applying…" : "Apply"}
              </button>
              <button className="text-button" onClick={() => { setSelectedIds([]); setBulkAction(""); }}>Clear</button>
            </div>
          </div>
        )}
        
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th><input type="checkbox" checked={students.length > 0 && selectedIds.length === students.length} onChange={toggleSelectAll} /></th>
                <th><button className="table-sort-button" onClick={() => toggleSort("name")}>Student <ArrowUpDown size={13} /></button></th>
                <th><button className="table-sort-button" onClick={() => toggleSort("admissionNo")}>Admission no. <ArrowUpDown size={13} /></button></th>
                <th><button className="table-sort-button" onClick={() => toggleSort("className")}>Class <ArrowUpDown size={13} /></button></th>
                <th>Section</th>
                <th>Year</th>
                <th>Parent phone</th>
                <th><button className="table-sort-button" onClick={() => toggleSort("status")}>Status <ArrowUpDown size={13} /></button></th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{textAlign: "center", padding: "2rem"}}>Loading directory...</td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan={9}><EmptyState icon={<Users size={40} />} title="No students found" description="Try adjusting your search or filters" /></td></tr>
              ) : (
                students.map(student => <StudentRow key={student.id} student={student} selected={selectedIds.includes(student.id)} onToggle={() => toggleSelect(student.id)} onNavigate={navigate} />)
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} pageSize={pageSize} onPageChange={setPage} />
      </section>
    </div>
  );
}

const StudentRow = memo(function StudentRow({ student, selected, onToggle, onNavigate }: { student: Student; selected: boolean; onToggle: () => void; onNavigate: (path: string) => void }) {
  return (
    <tr>
      <td><input type="checkbox" checked={selected} onChange={onToggle} /></td>
      <td>
        <div className="student-cell">
          <span>{student.fullName.split(" ").map(n => n[0]).slice(0, 2).join("")}</span>
          <div>
            <strong>{student.fullName}</strong>
            <small>{student.studentUid}</small>
          </div>
        </div>
      </td>
      <td>{student.admissionNo}</td>
      <td>{student.className}</td>
      <td>{student.sectionName}</td>
      <td>{student.academicYear || "—"}</td>
      <td>{student.guardianPhone || "—"}</td>
      <td><span className={`status-badge ${student.status}`}>{student.status}</span></td>
      <td className="actions-cell">
        <button className="text-button" onClick={() => onNavigate(`/students/${student.id}`)}>View</button>
        <button className="icon-button text-muted"><MoreHorizontal size={16} /></button>
      </td>
    </tr>
  );
});
