# Architecture Lock

**Architecture is now frozen.** Do not introduce new technologies, modules, or schema redesigns unless explicitly requested. 

## Technology
* React
* TypeScript
* Express
* MySQL
* JWT
* Tailwind
* Shadcn UI

## Roles
* Super Admin
* School Admin

## Modules (Version 1)
* Landing Page
* School Selection
* Login
* Dashboard
* Student Management
* Bulk Upload
* Certificates
* Fees
* Reports
* Settings

## Modules (Version 2)
* Attendance
* Staff
* Library
* Transport
* Inventory
* Parent Portal

> **No additional architectural or technology changes are permitted without explicit approval.**

## Database Strategy
* Preserve the school master data and administrator accounts.
* Keep the legacy database schema.
* Launch with empty student tables for V1.
* Schools will upload their current student data through the new Bulk Upload process.
* **CRITICAL**: Archive the legacy student data (via database export) before any cleanup so it is safely available if the client requests historical records.
