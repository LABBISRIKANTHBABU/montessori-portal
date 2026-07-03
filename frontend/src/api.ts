export type School = { id: number; code: string; name: string; city: string };
export type Student = {
  id: number;
  studentUid: string;
  admissionNo: string;
  fullName: string;
  className: string;
  sectionName: string;
  gender: string;
  status: string;
};

const TOKEN_KEY = "monte_token";

export const token = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (value: string) => localStorage.setItem(TOKEN_KEY, value),
  clear: () => localStorage.removeItem(TOKEN_KEY)
};

let refreshInFlight: Promise<boolean> | null = null;
async function refreshAccess() {
  if (!refreshInFlight) refreshInFlight = fetch("/api/auth/refresh", { method: "POST", credentials: "include" }).then(async response => {
    if (!response.ok) return false;
    const body = await response.json(); token.set(body.token); return true;
  }).finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}
async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const isForm = options.body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(!isForm ? { "Content-Type": "application/json" } : {}),
      ...(token.get() ? { Authorization: `Bearer ${token.get()}` } : {}),
      ...options.headers
    }
  });
  if (response.status === 401 && retry && !path.startsWith("/auth/")) {
    if (await refreshAccess()) return request<T>(path, options, false);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Something went wrong");
  return body;
}

function buildDateQuery(from: string, to: string): string {
  const params: string[] = [];
  if (from) params.push(`from=${from}`);
  if (to) params.push(`to=${to}`);
  return params.length ? `?${params.join("&")}` : "";
}

export const api = {
  schools: () => request<{ data: School[] }>("/schools"),
  login: (payload: { schoolId: number; email: string; password: string }) =>
    request<{ token: string; mustChangePassword?: boolean; user: { name: string; role: string }; school: School }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  dashboard: () => request<{ data: DashboardData }>("/dashboard"),
  changePassword: (payload:{currentPassword:string;newPassword:string}) => request<{message:string;token:string}>("/auth/change-password",{method:"POST",body:JSON.stringify(payload)}),
  logout: () => request<{message:string}>("/auth/logout",{method:"POST"}),
  students: (query = "", status = "", page = 1) => request<{ data: Student[]; total: number; page: number; limit: number }>(`/students?search=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}&page=${page}`),
  academicSetup: () => request<{ data: { academicYears: string[]; boards: string[]; classes: string[] } }>("/academic/setup"),
  createStudent: (payload: FormData) =>
    request<{ data: Student }>("/students", { method: "POST", body: payload }),
  student: (id:number) => request<{data:any}>(`/students/${id}`),
  updateStudent: (id:number,payload:Record<string,string>) => request<{data:any}>(`/students/${id}`,{method:"PUT",body:JSON.stringify(payload)}),
  changeStudentStatus: (id:number,payload:{status:string;reason?:string}) => request<{data:any}>(`/students/${id}/status`,{method:"PATCH",body:JSON.stringify(payload)}),
  restoreStudent: (id:number) => request<{data:any}>(`/students/${id}/restore`,{method:"POST"}),
  exportStudents: (search = "", status = "", format: "csv" | "xlsx" = "csv") => `/api/students/export?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&format=${format}`,
  bulkPromote: (studentIds: number[], targetClass: string, targetSection?: string) =>
    request<{data:any}>("/students/bulk/promote",{method:"POST",body:JSON.stringify({studentIds,targetClass,targetSection})}),
  bulkAssign: (studentIds: number[], assignType: "class" | "section", value: string) =>
    request<{data:any}>("/students/bulk/assign",{method:"POST",body:JSON.stringify({studentIds,assignType,value})}),
  studentTimeline: (id: number) => request<{data:any[]}>(`/students/${id}/timeline`),
  studentMedical: (id: number) => request<{data:any}>(`/students/${id}/medical`),
  updateStudentMedical: (id: number, payload: any) => request<{data:any}>(`/students/${id}/medical`,{method:"PUT",body:JSON.stringify(payload)}),
  studentNotes: (id: number, noteType = "") => request<{data:any[]}>(`/students/${id}/notes${noteType ? `?noteType=${noteType}` : ""}`),
  createStudentNote: (id: number, payload: {noteType:string;title:string;content:string}) =>
    request<{data:any}>(`/students/${id}/notes`,{method:"POST",body:JSON.stringify(payload)}),
  deleteStudentNote: (noteId: number) => request<{data:any}>(`/students/notes/${noteId}`,{method:"DELETE"}),
  checkDuplicate: (admissionNo: string, excludeId?: number) => request<{duplicate: boolean; existing: any}>(`/students/check-duplicate?admissionNo=${encodeURIComponent(admissionNo)}${excludeId ? `&excludeId=${excludeId}` : ""}`),
  imports:()=>request<{data:any[]}>("/imports"),
  importBatch:(id:string)=>request<{data:any}>(`/imports/${id}`),
  uploadImport:(file:File)=>{const form=new FormData();form.append("file",file);return request<{data:any}>("/imports/upload",{method:"POST",body:form});},
  stageLegacy:()=>request<{data:any}>("/imports/legacy/stage",{method:"POST"}),
  approveImport:(id:string)=>request<{data:any}>(`/imports/${id}/approve`,{method:"POST"}),
  rejectImport:(id:string)=>request<{data:any}>(`/imports/${id}/reject`,{method:"POST"}),
  rollbackImport:(id:string)=>request<{data:any}>(`/imports/${id}/rollback`,{method:"POST"}),
  downloadImportErrors:async(id:string)=>{const response=await fetch(`/api/imports/${id}/errors.csv`,{credentials:"include",headers:{Authorization:`Bearer ${token.get()}`}});if(!response.ok)throw new Error("Could not download error report.");return response.blob();},
  viewErrorReport:(id:string)=>`/api/imports/${id}/errors.html`,

  // Documents
  documentCategories: () => request<{ data: any[] }>("/documents/categories"),
  studentDocuments: (studentId: number, includeArchived = false) => request<{ data: any[] }>(`/documents/students/${studentId}/documents${includeArchived ? "?archived=1" : ""}`),
  searchDocuments: (q: string, category = "") => request<{ data: any[] }>(`/documents/search?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`),
  uploadDocument: (studentId: number, payload: FormData) => request<{ data: any }>(`/documents/students/${studentId}/documents`, { method: "POST", body: payload }),
  previewDocument: (docId: number) => `/api/documents/${docId}/preview`,
  downloadDocument: async (docId: number) => { const r = await fetch(`/api/documents/${docId}/download`, { credentials: "include", headers: { Authorization: `Bearer ${token.get()}` } }); if (!r.ok) throw new Error("Download failed."); return r.blob(); },
  replaceDocument: (docId: number, payload: FormData) => request<{ data: any }>(`/documents/${docId}/replace`, { method: "PUT", body: payload }),
  archiveDocument: (docId: number) => request<{ data: any }>(`/documents/${docId}/archive`, { method: "PATCH" }),
  restoreDocument: (docId: number) => request<{ data: any }>(`/documents/${docId}/restore`, { method: "PATCH" }),
  deleteDocument: (docId: number) => request<{ data: any }>(`/documents/${docId}`, { method: "DELETE" }),
  documentVersions: (docId: number) => request<{ data: any[] }>(`/documents/${docId}/versions`),
  studentArchivedDocuments: (studentId: number) => request<{ data: any[] }>(`/documents/students/${studentId}/archived`),

  // Certificates
  studentCertificates: (studentId: number) => request<{ data: any[] }>(`/certificates/students/${studentId}/certificates`),
  generateCertificate: (studentId: number, payload: { certificateType: string; academicYear?: string; reason?: string }) => request<{ data: any }>(`/certificates/students/${studentId}/certificates`, { method: "POST", body: JSON.stringify(payload) }),
  listCertificates: (type = "", status = "") => request<{ data: any[] }>(`/certificates?type=${type}&status=${status}`),
  previewCertificate: (id: number) => `/api/certificates/${id}/preview`,
  downloadCertificate: async (id: number) => { const r = await fetch(`/api/certificates/${id}/download`, { credentials: "include", headers: { Authorization: `Bearer ${token.get()}` } }); if (!r.ok) throw new Error("Download failed."); return r.blob(); },
  certificateHistory: (id: number) => request<{ data: any[] }>(`/certificates/${id}/history`),
  revokeCertificate: (id: number) => request<{ data: any }>(`/certificates/${id}/revoke`, { method: "PATCH" }),

  // Accounts
  accountsDashboard: () => request<{ data: any }>("/accounts/dashboard"),
  feeCategories: () => request<{ data: any[] }>("/accounts/fee-categories"),
  createFeeCategory: (payload: { name: string; description?: string }) => request<{ data: any }>("/accounts/fee-categories", { method: "POST", body: JSON.stringify(payload) }),
  feeStructures: (year = "", cls = "") => request<{ data: any[] }>(`/accounts/fee-structures?year=${year}&class=${cls}`),
  createFeeStructure: (payload: any) => request<{ data: any }>("/accounts/fee-structures", { method: "POST", body: JSON.stringify(payload) }),
  feePayments: (studentId = 0, year = "") => request<{ data: any[] }>(`/accounts/fee-payments?studentId=${studentId}&year=${year}`),
  collectFee: (payload: any) => request<{ data: any }>("/accounts/fee-payments", { method: "POST", body: JSON.stringify(payload) }),
  studentFees: (studentId: number, year = "") => request<{ data: any }>(`/accounts/students/${studentId}/fees?year=${year}`),
  receiptPreview: (id: number) => `/api/accounts/fee-payments/${id}/receipt/preview`,
  receiptPdf: (id: number) => `/api/accounts/fees/receipt/${id}/pdf`,
  cashbook: (date = "") => request<{ data: any[] }>(`/accounts/cashbook?date=${date}`),
  addCashbookEntry: (payload: any) => request<{ data: any }>("/accounts/cashbook", { method: "POST", body: JSON.stringify(payload) }),
  cashbookExport: (date = "") => `/api/accounts/reports/cashbook/export?date=${date}`,
  bankBook: (month = "") => request<{ data: any[] }>(`/accounts/bank-book?month=${month}`),
  suppliers: () => request<{ data: any[] }>("/accounts/suppliers"),
  createSupplier: (payload: any) => request<{ data: any }>("/accounts/suppliers", { method: "POST", body: JSON.stringify(payload) }),
  supplierTransactions: (id: number) => request<{ data: any[] }>(`/accounts/suppliers/${id}/transactions`),
  addSupplierTransaction: (id: number, payload: any) => request<{ data: any }>(`/accounts/suppliers/${id}/transactions`, { method: "POST", body: JSON.stringify(payload) }),
  supplierOutstanding: () => request<{ data: any[] }>("/accounts/suppliers/outstanding"),
  supplierExport: (id: number) => `/api/accounts/suppliers/${id}/export`,
  vouchers: (type = "") => request<{ data: any[] }>(`/accounts/vouchers?type=${type}`),
  createVoucher: (payload: any) => request<{ data: any }>("/accounts/vouchers", { method: "POST", body: JSON.stringify(payload) }),
  voucherPreview: (id: number) => `/api/accounts/vouchers/${id}/preview`,
  voucherPdf: (id: number) => `/api/accounts/vouchers/${id}/pdf`,
  voucherExport: (type = "") => `/api/accounts/vouchers/export?type=${type}`,
  concessions: (studentId = 0, year = "") => request<{ data: any[] }>(`/accounts/concessions?studentId=${studentId}&year=${year}`),
  createConcession: (payload: any) => request<{ data: any }>("/accounts/concessions", { method: "POST", body: JSON.stringify(payload) }),
  approveConcession: (id: number) => request<{ data: any }>(`/accounts/concessions/${id}/approve`, { method: "PATCH" }),
  rejectConcession: (id: number) => request<{ data: any }>(`/accounts/concessions/${id}/reject`, { method: "PATCH" }),
  dailyCollection: (date = "") => request<{ data: any }>(`/accounts/reports/daily-collection?date=${date}`),
  feeDefaulters: (year = "") => request<{ data: any[] }>(`/accounts/reports/fee-defaulters?year=${year}`),
  feeDefaultersExport: (year = "") => `/api/accounts/reports/fee-defaulters/export?year=${year}`,
  monthlyCollection: (month = "") => request<{ data: any }>(`/accounts/reports/monthly-collection?month=${month}`),
  expenseReport: (month = "") => request<{ data: any }>(`/accounts/reports/expense?month=${month}`),
  cashFlow: (startDate = "", endDate = "") => request<{ data: any }>(`/accounts/reports/cash-flow?startDate=${startDate}&endDate=${endDate}`),
  weeklyReport: () => request<{ data: any }>("/accounts/reports/weekly"),
  annualReport: (year = "") => request<{ data: any }>(`/accounts/reports/annual?year=${year}`),
  balanceSheet: (asOfDate = "") => request<{ data: any }>(`/accounts/reports/balance-sheet?asOfDate=${asOfDate}`),
  profitAndLoss: (startDate = "", endDate = "") => request<{ data: any }>(`/accounts/reports/profit-loss?startDate=${startDate}&endDate=${endDate}`),
  trialBalance: (asOfDate = "") => request<{ data: any }>(`/accounts/reports/trial-balances?asOfDate=${asOfDate}`),
  closeFiscalYear: (payload: { fiscalYear: string; closingDate: string; carryForward?: boolean }) =>
    request<{ data: any }>("/accounts/fiscal-year/close", { method: "POST", body: JSON.stringify(payload) }),
  auditTrail: (entityType = "", limit = 50) => request<{ data: any[] }>(`/accounts/audit?entityType=${entityType}&limit=${limit}`),

  // Events
  eventsDashboard: () => request<{ data: any }>("/events/dashboard"),
  eventsArchive: (year = "") => request<{ data: any[] }>(`/events/archive?year=${year}`),
  events: (type = "", status = "") => request<{ data: any[] }>(`/events?type=${type}&status=${status}`),
  event: (id: number) => request<{ data: any }>(`/events/${id}`),
  createEvent: (payload: any) => request<{ data: any }>("/events", { method: "POST", body: JSON.stringify(payload) }),
  updateEvent: (id: number, payload: any) => request<{ data: any }>(`/events/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  updateEventStatus: (id: number, status: string) => request<{ data: any }>(`/events/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  deleteEvent: (id: number) => request<{ data: any }>(`/events/${id}`, { method: "DELETE" }),
  addEventParticipants: (id: number, studentIds: number[]) => request<{ data: any }>(`/events/${id}/participants`, { method: "POST", body: JSON.stringify({ studentIds }) }),
  removeEventParticipant: (eventId: number, studentId: number) => request<{ data: any }>(`/events/${eventId}/participants/${studentId}`, { method: "DELETE" }),
  updateAttendance: (id: number, records: any[]) => request<{ data: any }>(`/events/${id}/attendance`, { method: "PATCH", body: JSON.stringify({ records }) }),
  uploadEventMedia: (id: number, payload: FormData) => request<{ data: any }>(`/events/${id}/media`, { method: "POST", body: payload }),
  downloadEventMedia: (id: number) => `/api/events/media/${id}/download`,
  deleteEventMedia: (id: number) => request<{ data: any }>(`/events/media/${id}`, { method: "DELETE" }),
  eventFolders: (eventId: number) => request<{ data: any[] }>(`/events/${eventId}/folders`),
  createEventFolder: (eventId: number, payload: any) => request<{ data: any }>(`/events/${eventId}/folders`, { method: "POST", body: JSON.stringify(payload) }),
  deleteEventFolder: (folderId: number) => request<{ data: any }>(`/events/folders/${folderId}`, { method: "DELETE" }),
  eventBudgets: (eventId: number) => request<{ data: any[] }>(`/events/${eventId}/budgets`),
  createEventBudget: (eventId: number, payload: any) => request<{ data: any }>(`/events/${eventId}/budgets`, { method: "POST", body: JSON.stringify(payload) }),
  deleteEventBudget: (budgetId: number) => request<{ data: any }>(`/events/budgets/${budgetId}`, { method: "DELETE" }),
  eventReports: () => request<{ data: any }>("/events/reports"),

  // Reports
  enrollmentReport: (from = "", to = "") => request<{ data: any[] }>(`/reports/students/enrollment${buildDateQuery(from, to)}`),
  enrollmentReportExport: (from = "", to = "") => `/api/reports/students/enrollment/export${buildDateQuery(from, to)}`,
  statusReport: (from = "", to = "") => request<{ data: any[] }>(`/reports/students/status${buildDateQuery(from, to)}`),
  statusReportExport: (from = "", to = "") => `/api/reports/students/status/export${buildDateQuery(from, to)}`,
  feeCollectionReport: (year = "", from = "", to = "") => request<{ data: any[] }>(`/reports/fees/collection?year=${year}${buildDateQuery(from, to)}`),
  feeCollectionReportExport: (year = "", from = "", to = "") => `/api/reports/fees/collection/export?year=${year}${buildDateQuery(from, to)}`,
  certificateReport: (from = "", to = "") => request<{ data: any[] }>(`/reports/certificates${buildDateQuery(from, to)}`),
  certificateReportExport: (from = "", to = "") => `/api/reports/certificates/export${buildDateQuery(from, to)}`,
  financialSummary: (date = "") => request<{ data: any }>(`/reports/financial/summary?date=${date}`),
  financialSummaryExport: (from = "", to = "") => `/api/reports/financial/summary/export${buildDateQuery(from, to)}`,
  eventReport: (from = "", to = "") => request<{ data: any[] }>(`/reports/events/summary${buildDateQuery(from, to)}`),
  eventReportExport: (from = "", to = "") => `/api/reports/events/summary/export${buildDateQuery(from, to)}`,
  documentReport: (from = "", to = "") => request<{ data: any[] }>(`/reports/documents/summary${buildDateQuery(from, to)}`),
  documentReportExport: (from = "", to = "") => `/api/reports/documents/summary/export${buildDateQuery(from, to)}`,

  // Attendance Report
  attendanceReport: (from = "", to = "") => request<{ data: any[] }>(`/reports/attendance${buildDateQuery(from, to)}`),
  attendanceReportExport: (from = "", to = "") => `/api/reports/attendance/export${buildDateQuery(from, to)}`,
  attendanceSummary: (from = "", to = "") => request<{ data: any[] }>(`/reports/attendance/summary${buildDateQuery(from, to)}`),

  // Staff Report
  staffReport: (role = "") => request<{ data: any[] }>(`/reports/staff${role ? `?role=${role}` : ""}`),
  staffReportExport: (role = "") => `/api/reports/staff/export${role ? `?role=${role}` : ""}`,
  staffSummary: () => request<{ data: any[] }>("/reports/staff/summary"),

  // Parent Report
  parentReport: () => request<{ data: any[] }>("/reports/parents"),
  parentReportExport: () => "/api/reports/parents/export",

  // Custom Report Builder
  customReport: (config: any) => request<{ data: any }>("/reports/custom", { method: "POST", body: JSON.stringify(config) }),

  // Saved Reports
  savedReports: () => request<{ data: any[] }>("/reports/saved"),
  saveReport: (payload: { name: string; type: string; config: any; shared?: boolean }) =>
    request<{ data: any }>("/reports/saved", { method: "POST", body: JSON.stringify(payload) }),
  updateSavedReport: (id: number, payload: { name?: string; config?: any; shared?: boolean }) =>
    request<{ data: any }>(`/reports/saved/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteSavedReport: (id: number) => request<{ data: any }>(`/reports/saved/${id}`, { method: "DELETE" }),

  // Users
  users: () => request<{ data: any[] }>("/users"),
  user: (id: number) => request<{ data: any }>(`/users/${id}`),
  createUser: (payload: any) => request<{ data: any }>("/users", { method: "POST", body: JSON.stringify(payload) }),
  updateUser: (id: number, payload: any) => request<{ data: any }>(`/users/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteUser: (id: number) => request<{ data: any }>(`/users/${id}`, { method: "DELETE" }),
  deactivateUser: (id: number) => request<{ data: any }>(`/users/${id}/deactivate`, { method: "PATCH" }),
  activateUser: (id: number) => request<{ data: any }>(`/users/${id}/activate`, { method: "PATCH" }),
  resetPassword: (id: number, password: string) => request<{ data: any }>(`/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ newPassword: password }) }),
  roles: () => request<{ data: any[] }>("/users/roles/list"),

  // Settings
  settings: () => request<{ data: Record<string, string | null> }>("/settings"),
  updateSetting: (key: string, value: string) => request<{ data: any }>(`/settings/${key}`, { method: "PUT", body: JSON.stringify({ value }) }),
  uploadLogo: (payload: FormData) => request<{ data: any }>("/settings/logo", { method: "POST", body: payload }),
  uploadSignature: (payload: FormData) => request<{ data: any }>("/settings/signature", { method: "POST", body: payload }),
  uploadSecretarySignature: (payload: FormData) => request<{ data: any }>("/settings/secretary-signature", { method: "POST", body: payload }),
  uploadStamp: (payload: FormData) => request<{ data: any }>("/settings/stamp", { method: "POST", body: payload }),
  backupDatabase: () => request<{ data: { message: string; backupId: string; timestamp: string } }>("/settings/backup", { method: "POST" }),
  importHistory: () => request<{ data: any[] }>("/imports/history"),
  cancelImport: (batchId: string) => request<{ data: any }>(`/imports/${batchId}/cancel`, { method: "POST" }),
  importProgress: (batchId: string) => request<{ data: any }>(`/imports/${batchId}/progress`),
  resumeImport: (batchId: string) => request<{ data: any }>(`/imports/${batchId}/resume`, { method: "POST" }),
  academicYears: () => request<{ data: any[] }>("/settings/academic-years"),
  createAcademicYear: (payload: any) => request<{ data: any }>("/settings/academic-years", { method: "POST", body: JSON.stringify(payload) }),
  updateAcademicYear: (id: number, payload: any) => request<{ data: any }>(`/settings/academic-years/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteAcademicYear: (id: number) => request<{ data: any }>(`/settings/academic-years/${id}`, { method: "DELETE" }),
  boards: () => request<{ data: any[] }>("/settings/boards"),
  classes: () => request<{ data: any[] }>("/settings/classes"),
  auditLog: (limit = 50) => request<{ data: any[] }>(`/settings/audit-log?limit=${limit}`),
  systemLogs: (limit = 50) => request<{ data: any[] }>(`/settings/system-logs?limit=${limit}`),

  // Reports dashboard
  reportsDashboard: () => request<{ data: any }>("/reports/dashboard"),

  // Global search
  search: (q: string) => request<{ data: { type: string; id: number; title: string; subtitle: string; module: string }[] }>(`/search?q=${encodeURIComponent(q)}`),

  // Notifications
  notifications: () => request<{ data: { unreadCount: number; notifications: any[] } }>("/notifications"),
  markNotificationsRead: (ids?: number[]) => request<{ message: string }>("/notifications/read", { method: "PATCH", body: JSON.stringify({ ids }) }),

  // Extended dashboard
  dashboardExtended: () => request<{ data: any }>("/dashboard/extended"),
};

export type DashboardData = {
  totals: { students: number; active: number; schools: number; pendingCertificates: number };
  enrollmentByClass: { label: string; value: number }[];
  recent: { title: string; meta: string; time: string }[];
};

export type SearchResult = { type: string; id: number; title: string; subtitle: string; module: string };
export type Notification = { id: number; title: string; message: string; type: string; read: boolean; createdAt: string; module: string; entityId: number | null };
