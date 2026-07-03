# Montessori Portal - Documentation Index

## Product & Requirements

| Document | Description |
|---|---|
| [LAUNCH_SCOPE.md](./LAUNCH_SCOPE.md) | Version 1.0/1.1/2.0 feature scope and release plan |
| [31_BUSINESS_RULES.md](./31_BUSINESS_RULES.md) | Business rules, validation logic, and constraints |

## Architecture & Design

| Document | Description |
|---|---|
| [ARCHITECTURE_LOCK.md](./ARCHITECTURE_LOCK.md) | Locked architecture decisions |
| [30_APPLICATION_WORKFLOW.md](./30_APPLICATION_WORKFLOW.md) | Application workflow and data flow |
| [STUDENT_MASTER_SCHEMA.md](./STUDENT_MASTER_SCHEMA.md) | Student data model and field definitions |
| [32_SCHEMA_NAMING_DECISION.md](./32_SCHEMA_NAMING_DECISION.md) | v2_ table prefix decision and migration path |

## Implementation

| Document | Description |
|---|---|
| [COMPLETE_DEVELOPMENT_HANDBOOK.md](./COMPLETE_DEVELOPMENT_HANDBOOK.md) | Full technical reference (952 lines) |
| [STUDENT_MODULE_IMPLEMENTATION.md](./STUDENT_MODULE_IMPLEMENTATION.md) | Student field mapping and data rules |
| [IMPORT_WORKFLOW_RUNBOOK.md](./IMPORT_WORKFLOW_RUNBOOK.md) | Bulk import procedure and validation |
| [API_CONTRACT.md](./API_CONTRACT.md) | Endpoint contracts with example payloads |

## Operations

| Document | Description |
|---|---|
| [PRODUCTION_DATABASE_RUNBOOK.md](./PRODUCTION_DATABASE_RUNBOOK.md) | Production database setup |
| [PRODUCTION_READINESS_CHECKLIST.md](./PRODUCTION_READINESS_CHECKLIST.md) | Release gate checklist |
| [LOCAL_SETUP.md](./LOCAL_SETUP.md) | Local development setup guide |

## Quality & Testing

| Document | Description |
|---|---|
| [40_RELEASE_CHECKLIST.md](./40_RELEASE_CHECKLIST.md) | Version 1.0 release checklist (all modules) |
| [CLIENT_ACCEPTANCE_TEST.md](./CLIENT_ACCEPTANCE_TEST.md) | 30 real-world test scenarios for client sign-off |

---

## Reading Order

For new team members:

1. Start with `LAUNCH_SCOPE.md` to understand what we're building
2. Read `30_APPLICATION_WORKFLOW.md` for the user journey
3. Read `ARCHITECTURE_LOCK.md` for technical decisions
4. Read `LOCAL_SETUP.md` to get running locally
5. Use `COMPLETE_DEVELOPMENT_HANDBOOK.md` as your daily reference

For client acceptance:

1. Run through `CLIENT_ACCEPTANCE_TEST.md` scenarios
2. Verify every checkbox in `40_RELEASE_CHECKLIST.md`
