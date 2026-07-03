# Client Acceptance Test

Real-world scenarios for client sign-off. Each scenario mirrors a daily workflow a school administrator would perform.

Run through every scenario. If any fails, Version 1.0 is not ready.

---

## Scenario 1: Login as School Admin

**Steps:**
1. Open the website
2. See 9 campus cards on the landing page
3. Click "Montessori EM High School"
4. Enter admin@montessori.edu / Montessori@2026
5. Click "Sign in securely"

**Expected:** Dashboard loads with school name, student count, and navigation sidebar.

---

## Scenario 2: Login as Super Admin

**Steps:**
1. Open the website
2. Click "Super Admin" in the top navigation
3. Enter superadmin@montessori.edu / Montessori@2026
4. Click "Sign in securely"

**Expected:** Platform overview loads showing cross-campus metrics (total students, active staff, 9 campuses).

---

## Scenario 3: Search for a School

**Steps:**
1. Open the website
2. Type "Kurnool" in the search bar

**Expected:** Schools in Kurnool are filtered. Other schools are hidden.

---

## Scenario 4: Add a New Student

**Steps:**
1. Login as School Admin
2. Click "Add student" on the dashboard
3. Fill in: Full Name = "Priya Sharma", Admission No = "ADM-2026-001"
4. Select Academic Year = "2026-27", Board = "CBSE"
5. Fill in Date of Admission, Date of Birth, Gender
6. Fill in Father Name, Mother Name, Mobile Numbers
7. Fill in Residence Address
8. Check the confirmation checkbox
9. Click "Submit admission"

**Expected:** Student is created. Profile page loads with all details. Admission number is unique within the school.

---

## Scenario 5: Search for a Student

**Steps:**
1. Login as School Admin
2. Navigate to Students
3. Type "Priya" in the search box

**Expected:** Priya Sharma appears in the results. Other students are filtered out.

---

## Scenario 6: View Student Profile

**Steps:**
1. Login as School Admin
2. Navigate to Students
3. Click "View" on Priya Sharma's row

**Expected:** Profile loads with General tab showing personal info, identifiers, and address. Parents tab shows father and mother details.

---

## Scenario 7: Edit Student Details

**Steps:**
1. Login as School Admin
2. Navigate to Priya Sharma's profile
3. Click Edit
4. Change Residence Address to "456 New Address, Kurnool"
5. Save changes

**Expected:** Profile updates. New address is displayed. Audit event is logged with timestamp.

---

## Scenario 8: Change Student Status

**Steps:**
1. Login as School Admin
2. Navigate to Priya Sharma's profile
3. Change status to "Withdrawn"
4. Enter reason: "Family relocated"

**Expected:** Status changes to "Withdrawn". Status history shows the change with timestamp and reason.

---

## Scenario 9: Filter Students by Status

**Steps:**
1. Login as School Admin
2. Navigate to Students
3. Select "Withdrawn" from the status filter dropdown

**Expected:** Only withdrawn students appear. Priya Sharma is in the list. Active students are hidden.

---

## Scenario 10: Import Students from Excel

**Steps:**
1. Login as School Admin
2. Navigate to Students > Bulk Import
3. Download the template
4. Fill in 5 student records in the template
5. Upload the file
6. Review the validation preview (valid/error/duplicate counts)
7. Click "Approve & Import"

**Expected:** All 5 valid records are imported. Students appear in the directory. Import batch is recorded in history.

---

## Scenario 11: Upload a Student Document

**Steps:**
1. Login as School Admin
2. Navigate to Priya Sharma's profile
3. Go to Documents tab
4. Click "Upload Document"
5. Select document type = "Aadhaar"
6. Upload the Aadhaar PDF
7. Confirm upload

**Expected:** Document appears in the student's document list with upload date, file size, and uploaded by info.

---

## Scenario 12: Preview a Student Document

**Steps:**
1. Login as School Admin
2. Navigate to Priya Sharma's profile > Documents
3. Click on the Aadhaar document

**Expected:** Document preview opens inline (PDF viewer or image preview). Full resolution is visible.

---

## Scenario 13: Download a Student Document

**Steps:**
1. Login as School Admin
2. Navigate to Priya Sharma's profile > Documents
3. Click "Download" on the Aadhaar document

**Expected:** Original file downloads to the local machine with correct filename.

---

## Scenario 14: Generate a Bonafide Certificate

**Steps:**
1. Login as School Admin
2. Navigate to Priya Sharma's profile > Certificates
3. Click "Generate Certificate"
4. Select "Bonafide Certificate"
5. Preview the certificate
6. Click "Generate PDF"

**Expected:** PDF is generated with student details auto-filled, school logo, principal signature, and QR code. Certificate appears in the student's certificate history.

---

## Scenario 15: Generate a Transfer Certificate

**Steps:**
1. Login as School Admin
2. Navigate to Priya Sharma's profile > Certificates
3. Click "Generate Certificate"
4. Select "Transfer Certificate"
5. Fill in leaving date, reason
6. Preview and generate PDF

**Expected:** TC is generated with all required fields. Certificate is saved and downloadable.

---

## Scenario 16: Print a Certificate

**Steps:**
1. Login as School Admin
2. Generate a Bonafide Certificate for Priya Sharma
3. Click "Print"

**Expected:** Print dialog opens with A4 layout. Certificate prints correctly with school branding.

---

## Scenario 17: Collect a Fee Payment

**Steps:**
1. Login as School Admin
2. Navigate to Priya Sharma's profile > Fees
3. Click "Collect Payment"
4. Select fee type = "Tuition Fee"
5. Enter amount = 25000
6. Select payment mode = "Cash"
7. Click "Submit Payment"

**Expected:** Payment is recorded. Receipt is generated. Student's fee balance updates (pending decreases).

---

## Scenario 18: View Fee Receipt

**Steps:**
1. Login as School Admin
2. Navigate to Priya Sharma's profile > Fees
3. Click on the latest payment
4. View the receipt

**Expected:** Receipt shows school name, receipt number, date, student name, fee type, amount, payment mode. Receipt is printable.

---

## Scenario 19: Check Pending Fees

**Steps:**
1. Login as School Admin
2. Navigate to Dashboard

**Expected:** Pending fees widget shows count of students with outstanding fees. Clicking it navigates to the fee defaulters list.

---

## Scenario 20: View Dashboard

**Steps:**
1. Login as School Admin
2. View the dashboard

**Expected:** Dashboard shows: total students, active students, enrollment by class chart, recent activity feed, pending certificates, upcoming events. "Add Student" button is visible.

---

## Scenario 21: Create an Event

**Steps:**
1. Login as School Admin
2. Navigate to Events
3. Click "Create Event"
4. Enter: Name = "Annual Day", Date = "2026-12-15", Type = "Cultural"
5. Add description
6. Save event

**Expected:** Event appears in the calendar and event list. Students can be assigned to participate.

---

## Scenario 22: Upload Event Photos

**Steps:**
1. Login as School Admin
2. Navigate to Annual Day event
3. Click "Upload Photos"
4. Select multiple image files
5. Confirm upload

**Expected:** Photos appear in the event gallery. Photos are organized by upload date.

---

## Scenario 23: View Event Archive

**Steps:**
1. Login as School Admin
2. Navigate to Events > Archive

**Expected:** Past events are listed with photos, videos, and attendance summary. Events are searchable by date and type.

---

## Scenario 24: Generate a Fee Report

**Steps:**
1. Login as School Admin
2. Navigate to Reports > Fees
3. Select date range
4. Click "Generate Report"

**Expected:** Report shows total collection, pending amounts, fee-wise breakdown. Report is exportable to Excel.

---

## Scenario 25: Generate a Student Report

**Steps:**
1. Login as School Admin
2. Navigate to Reports > Students
3. Select report type = "Class-wise enrollment"
4. Click "Generate"

**Expected:** Report shows student count per class, status breakdown, gender distribution. Report is printable.

---

## Scenario 26: Logout

**Steps:**
1. Login as School Admin
2. Click the logout button in the sidebar

**Expected:** Session ends. Redirected to landing page. Cannot access dashboard without re-login.

---

## Scenario 27: Session Timeout

**Steps:**
1. Login as School Admin
2. Wait 15 minutes without activity
3. Try to navigate to Students

**Expected:** Session expires. Redirected to login page with "Session expired" message.

---

## Scenario 28: Wrong Password Login

**Steps:**
1. Open the website
2. Select a school
3. Enter admin@montessori.edu / wrongpassword
4. Click "Sign in"

**Expected:** Error message "Incorrect email or password." No access granted.

---

## Scenario 29: Switch Between Schools

**Steps:**
1. Login as School Admin for Montessori EM High School
2. Logout
3. Click "Montessori High School" (different campus)
4. Login with same credentials

**Expected:** Dashboard loads for the selected school. Students shown belong to that school only. Data is isolated per campus.

---

## Scenario 30: Responsive Mobile Access

**Steps:**
1. Open the website on a mobile phone
2. Browse schools
3. Login
4. View dashboard
5. Navigate to Students
6. Search for a student
7. View student profile

**Expected:** All pages render correctly on mobile. Sidebar collapses to hamburger menu. Tables scroll horizontally. Forms stack vertically. No horizontal overflow.

---

## Sign-Off

| Scenario | Pass/Fail | Notes |
|---|---|---|
| 1. Login as School Admin | | |
| 2. Login as Super Admin | | |
| 3. Search for a School | | |
| 4. Add a New Student | | |
| 5. Search for a Student | | |
| 6. View Student Profile | | |
| 7. Edit Student Details | | |
| 8. Change Student Status | | |
| 9. Filter Students by Status | | |
| 10. Import Students from Excel | | |
| 11. Upload a Student Document | | |
| 12. Preview a Student Document | | |
| 13. Download a Student Document | | |
| 14. Generate a Bonafide Certificate | | |
| 15. Generate a Transfer Certificate | | |
| 16. Print a Certificate | | |
| 17. Collect a Fee Payment | | |
| 18. View Fee Receipt | | |
| 19. Check Pending Fees | | |
| 20. View Dashboard | | |
| 21. Create an Event | | |
| 22. Upload Event Photos | | |
| 23. View Event Archive | | |
| 24. Generate a Fee Report | | |
| 25. Generate a Student Report | | |
| 26. Logout | | |
| 27. Session Timeout | | |
| 28. Wrong Password Login | | |
| 29. Switch Between Schools | | |
| 30. Responsive Mobile Access | | |

**Version 1.0 is accepted by the client when ALL 30 scenarios pass.**
