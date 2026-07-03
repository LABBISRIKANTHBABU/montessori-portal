# 30 Application Workflow (Master Workflow Document)

This is the locked Master Workflow Document. Every feature implemented in Version 1.0 must adhere strictly to these defined flows.

## 1. Public Flow

```text
Internet
↓
Landing Page
↓
Search Schools
↓
School Cards
↓
Select School
↓
School Login
↓
Dashboard
```

**Super Admin Public Flow:**
```text
Landing Page
↓
Super Admin
↓
Super Admin Login
↓
Platform Dashboard
```
*Note: No shortcuts. No automatic login.*

---

## 2. School Onboarding Flow

```text
Super Admin
↓
Create School
↓
Upload Logo
↓
Configure School
↓
Assign Admin
↓
Generate Credentials
↓
School Appears on Landing Page
```

---

## 3. Student Admission Flow

```text
Dashboard
↓
Students
↓
Add Student
↓
Step 1 Personal
↓
Step 2 Parents
↓
Step 3 Academic
↓
Step 4 Documents
↓
Review
↓
Save
↓
Student Profile Created
↓
Dashboard Updated
```
*Note: No direct database writes without validation.*

---

## 4. Bulk Upload Flow

```text
Download Template
↓
Upload File
↓
Validate Headers
↓
Validate Data
↓
Preview
↓
Import
↓
Generate Report
↓
Dashboard Updated
```

---

## 5. Certificate Flow

```text
Student Profile
↓
Certificates
↓
Choose Template
↓
Preview
↓
Generate PDF
↓
Save Copy
↓
Print
↓
Certificate History
```
*Note: Every generated certificate automatically appears in the student's profile history.*

---

## 6. Fee Workflow

```text
Fees
↓
Select Student
↓
Pending Balance
↓
Receive Payment
↓
Generate Receipt
↓
Update Dashboard
↓
Payment History
```

---

## 7. Events

```text
Events
↓
Create Event
↓
Upload Photos
↓
Save
↓
Gallery
```
*Note: Keep Version 1 simple. No complex approval workflow.*

---

## 8. Reports

```text
Reports
↓
Choose Report
↓
Apply Filters
↓
Preview
↓
Export
↓
Print
```

---

## 9. Logout

```text
Logout
↓
Invalidate Session
↓
Clear Token
↓
Redirect Landing
```

---

## 10. Permission Matrix

| Module       | Super Admin | Principal | Office Admin | Data Entry | Accountant |
| ------------ | ----------- | --------- | ------------ | ---------- | ---------- |
| Dashboard    | ✅           | ✅         | ✅            | ✅          | ✅          |
| Students     | Full        | Full      | Full         | Add/Edit   | View       |
| Bulk Upload  | Full        | Full      | Full         | Yes        | No         |
| Certificates | Full        | Approve   | Generate     | No         | No         |
| Fees         | Full        | View      | View         | No         | Full       |
| Reports      | Full        | Yes       | Yes          | Limited    | Financial  |
| Settings     | Full        | Limited   | No           | No         | No         |
| Users        | Full        | Limited   | No           | No         | No         |
