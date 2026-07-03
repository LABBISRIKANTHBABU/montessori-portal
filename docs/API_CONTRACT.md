# API Contracts: Student Management Module (Version 1.0)

This document outlines the API contracts for the Student Management module. The repository layer must implement these contracts interchangeably for both mock and MySQL environments.

## 1. Get Students (Directory)
**Endpoint:** `GET /api/students`
**Description:** Retrieves a paginated, filterable, and searchable list of students for the current school.
**Query Parameters:**
- `search` (string, optional): Search by name or admission number.
- `status` (enum, optional): active, alumni, withdrawn, suspended, deleted.
- `class` (string, optional): Filter by class.
- `page` (number, default 1).
- `limit` (number, default 50).
**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "studentUid": "STU12345",
      "admissionNo": "A-001",
      "fullName": "John Doe",
      "className": "Grade 1",
      "sectionName": "A",
      "gender": "male",
      "status": "active"
    }
  ],
  "total": 100,
  "page": 1,
  "totalPages": 2
}
```

## 2. Get Student Profile
**Endpoint:** `GET /api/students/:id`
**Description:** Retrieves the full profile of a specific student.
**Response (200 OK):**
```json
{
  "data": {
    "id": 1,
    "fullName": "John Doe",
    "personal": { /* DOB, Gender, etc */ },
    "parents": { /* Father, Mother details */ },
    "academic": { /* Admission info, Previous school */ },
    "documents": { /* Aadhaar, PAN */ },
    "timeline": [
      { "action": "Enrolled", "date": "2026-06-01", "user": "Admin" }
    ]
  }
}
```

## 3. Create Student (Wizard)
**Endpoint:** `POST /api/students`
**Description:** Creates a new student record.
**Payload:** `multipart/form-data` or `application/json` containing full 5-step wizard data.
**Response (201 Created):**
```json
{
  "data": { "id": 2, "studentUid": "STU9999", "message": "Student created successfully." }
}
```

## 4. Update Student
**Endpoint:** `PUT /api/students/:id`
**Description:** Updates an existing student record (full or partial depending on UI).
**Payload:** `application/json` (matching profile structure).
**Response (200 OK):**
```json
{
  "data": { "id": 1, "message": "Student updated successfully." }
}
```

## 5. Change Student Status (incl. Soft Delete)
**Endpoint:** `PATCH /api/students/:id/status`
**Description:** Updates the operational status of a student.
**Payload:**
```json
{
  "status": "active|alumni|withdrawn|suspended|deleted",
  "reason": "Optional reason for status change"
}
```
**Response (200 OK):**
```json
{
  "data": { "id": 1, "status": "deleted", "message": "Status updated." }
}
```

## 6. Restore Student
**Endpoint:** `POST /api/students/:id/restore`
**Description:** Restores a soft-deleted student back to active status.
**Response (200 OK):**
```json
{
  "data": { "id": 1, "status": "active", "message": "Student restored." }
}
```

## 7. Export Students
**Endpoint:** `POST /api/students/export`
**Description:** Generates an Excel/CSV export based on current filters.
**Payload:** (Same filters as GET `/api/students`).
**Response (200 OK):** Binary stream (`text/csv` or `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).
