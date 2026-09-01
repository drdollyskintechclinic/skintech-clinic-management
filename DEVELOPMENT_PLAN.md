# Development Plan — Dr Dolly's Skintech Clinic, Nagpur

## Repository baseline

This repository is an intentionally minimal starting point. At the time of this plan it contains only:

- `README.md` — a two-line project description.
- Git metadata on the `main` branch, configured with the GitHub origin.

There is no application source, package manifest, framework, database schema, environment configuration, test suite, or deployment configuration. This plan adds no implementation code and does not change the existing README.

## Agreed initial scope

The first release is an internal, single-location clinic-management system for **Dr Dolly's Skintech Clinic, Nagpur**. It will serve staff accounts only; patient-facing online booking and a patient portal are explicitly out of scope for the MVP.

The data model and authorization context will retain `Organization` and `ClinicLocation` boundaries so future branches can be added safely. However, multi-location operations—such as inter-branch appointments, inventory transfers, location-aware reporting, or cross-branch staff scheduling—will **not** be implemented or required for MVP acceptance.

The required MVP patient journey is:

```text
Lead → Enquiry → Appointment → Patient Registration → Consultation
     → Treatment Plan → Package → Treatment Sessions → Payment → Follow-up
```

The application must support the journey end-to-end while preserving its history, accountable staff assignments, financial status, and audit trail.

## Recommended technology stack

Build a modular monolith first: one deployable web application with clear module boundaries. It is simpler and safer to operate for a single clinic, while allowing individual integrations or reporting workloads to be separated later.

| Area | Recommendation | Why |
| --- | --- | --- |
| Web application | Next.js (current stable) with React, TypeScript, and the App Router | Full-stack, server-first application with a mature ecosystem and strong typing. |
| UI | Tailwind CSS, accessible headless components, and a clinic-specific design system | Fast, consistent internal-product UI without locking business logic to a vendor. |
| Server layer | Next.js route handlers/server actions plus a domain-service layer | Keeps browser clients away from data access and makes later API extraction straightforward. |
| Validation | Zod schemas shared between forms and server endpoints | Validates untrusted input at all boundaries. |
| Database | Managed PostgreSQL | Relational integrity and transactions are essential for clinical records, inventory, billing, and audit history. |
| Data access | Prisma ORM with explicit SQL migrations where needed | Typed queries and migrations; use database transactions for multi-record business operations. |
| Authentication | Auth.js or an equivalent established OIDC-compatible authentication layer | Secure session handling now, with a path to SSO/MFA later. |
| Files | S3-compatible private object storage | Suitable for consent forms, prescriptions, and clinical attachments without placing files in the database. |
| Background work | Database-backed job/outbox table initially; managed queue/worker when volume warrants it | Reliable reminders and integration delivery without prematurely operating extra infrastructure. |
| Observability | Structured logs, error tracking, metrics, health checks, and immutable audit events | Supports safe operations and incident investigation. |
| Tooling | pnpm, ESLint, Prettier, Vitest, Playwright, and GitHub Actions | Reproducible local development and automated quality gates. |

Pin exact major versions only when the project is scaffolded, based on then-current stable, mutually compatible releases. The architecture relies on standard Next.js App Router capabilities, PostgreSQL access controls, and transactional database operations rather than unstable framework-specific behavior.

## Application architecture

Use a single TypeScript repository, organized by business domain rather than by pages alone:

```text
src/
  app/                 # Routes, layouts, server-rendered screens, API endpoints
  modules/
    patients/
    leads/
    appointments/
    clinical/
    treatments/
    billing/
    accounting/
    inventory/
    identity/
    reporting/
  shared/              # UI primitives, validation, permissions, utilities
  server/
    db/                # Database client, migrations, repositories
    auth/              # Sessions, authorization middleware
    jobs/              # Outbox/jobs and worker handlers
    integrations/      # Provider adapters (WhatsApp later)
```

Each module owns its domain types, validation, permission checks, service/use-case functions, and repository interfaces. Route handlers and server actions call services; they do not directly contain billing, clinical, or authorization logic. Services enforce authorization again, so permissions are not dependent on a screen being hidden.

Create an integration boundary early: domain events are written to an outbox in the same database transaction as the originating change. A worker later delivers events to WhatsApp, analytics, or other providers. This prevents external calls from being mixed into critical appointment or payment transactions.

Start as a single Nagpur clinic, but include an `organization`/`clinic` boundary in key tables and authorization contexts. This is a future-expansion seam only, not an MVP requirement for multi-location workflows or screens.

## Database approach

- Use PostgreSQL as the system of record, UTC timestamps, UUID primary keys, foreign keys, check constraints, unique constraints, and indexed tenant/clinic plus common filter columns.
- Use a migration-first schema under version control. Production migrations are reviewed, applied through CI/CD, backward-compatible where possible, and never replaced by automatic schema pushes.
- Use `numeric`/minor-unit integers for money (recommended: integer paise) and never floating-point values. Capture the immutable financial documents/events from which balances are derived.
- Use transactions for appointment booking, stock movements, invoice/payment allocation, and clinical-document finalization.
- Store flexible, clinician-entered structured findings in versioned JSONB only where appropriate; keep identifiers, dates, money, status, and reporting fields relational.
- Use soft deletion/status archival for clinical, financial, and master records. Never hard-delete records that must be auditable.
- Encrypt and access-control document storage separately; store only object references and metadata in PostgreSQL.
- Back up production data automatically, encrypt backups, test restoration regularly, and define retention before launch.

## Authentication and role-based access

Use staff accounts only in the initial release. Authenticate with email/password using a proven library and strong password hashing, or a clinic-approved identity provider if one already exists. Use secure, HTTP-only, same-site cookies with session rotation and short idle/absolute expiry appropriate for a shared-clinic setting.

Authorization is permission-based, not role-name checks scattered through the code. Seed the roles below as permission bundles; allow only Admins to assign roles. Every protected server route and service evaluates the current staff member, active clinic, permission, and—where applicable—record ownership/assignment.

| Initial role | Initial scope |
| --- | --- |
| Admin | Full system, configuration, staff, records, financial data, audit access. |
| Doctor | Patient and appointment access; create/sign clinical consultations, prescriptions, and treatment plans; view relevant financial context. No staff/configuration administration by default. |
| Receptionist + Telecaller | Reception, leads/enquiries, appointments, permitted staff-led communications, patient registration, invoicing/payment collection, and basic accounting. No clinical-note editing or staff administration. |
| Therapist | View assigned patient, treatment-plan, package, and session context; record permitted treatment sessions and consumables. No financial configuration, full clinical history, or staff administration by default. |

Important controls: require re-authentication/MFA for privileged changes, log role and permission changes, revoke sessions on staff deactivation, and require clinical-note amendments rather than silent edits after signing.

## Main modules

1. **Identity and clinic settings** — staff, roles, permissions, single-Nagpur-clinic configuration, numbering, and tax settings.
2. **Patient management** — demographics, contacts, identifiers, consent, allergies/flags, documents, before/after photographs, merge/deduplication, and privacy requests.
3. **Lead/enquiry management** — source, campaign, owner, enquiry/follow-up history, conversion to patient, and lost-reason reporting.
4. **Appointments** — provider/room/resource schedules, booking, rescheduling, cancellation/no-show, check-in, and staff-led communication history.
5. **Consultations and clinical records** — encounter notes, vital/significant findings, diagnoses, clinical documents/photos, prescriptions, treatment plans, signing/amendments, and audit trail.
6. **Treatment packages and delivery** — package price, contracted sessions, sessions completed/remaining, validity/expiry, assigned doctor/therapist, planned and used consumables, session outcomes, payment/outstanding balance, and follow-up requirements.
7. **Basic billing and payments** — price lists, package sales, invoices, line items, approved discounts, payments, refunds, outstanding balances, and receipts.
8. **Basic accounting** — daily collections, cash/bank tracking, payment modes, expenses, outstanding payments, refunds, daily closing, and basic revenue/expense reports. Advanced/double-entry accounting is deferred.
9. **Inventory and consumables** — product/service catalog, stock receiving, stock movements, batch/expiry where relevant, reorder levels, and package/treatment consumption.
10. **Dashboard and essential reports** — role-aware operational dashboard, appointments, lead conversion, package/session status, collections/outstanding, basic revenue/expense, inventory, and audit reporting.
11. **Future communications and integrations** — WhatsApp automation, external channels/providers, callbacks, retries, and opt-out enforcement; intentionally deferred from MVP.

## Initial database entities

**Foundation:** `Organization`, `ClinicLocation`, `User`, `StaffProfile`, `Role`, `Permission`, `UserRole`, `Session`, `AuditEvent`, `FileAsset`, `OutboxEvent`.

**Patient and lead:** `Patient`, `PatientContact`, `PatientIdentifier`, `PatientConsent`, `PatientAlert`, `Lead`, `Enquiry`, `LeadActivity`, `LeadSource`, `FollowUpTask`.

**Scheduling and care:** `Appointment`, `AppointmentStatusHistory`, `ProviderAvailability`, `Room`, `Encounter`, `ClinicalNote`, `Diagnosis`, `Prescription`, `PrescriptionItem`, `TreatmentPlan`, `TreatmentPlanItem`, `TreatmentPackage`, `TreatmentPackageSession`, `TreatmentPackageAssignment`, `TreatmentPackageConsumable`, `TreatmentSession`, `TreatmentSessionConsumable`, `FollowUpTask`, `ClinicalAttachment`.

**Commercial:** `CatalogItem` (service/product/package), `PriceList`, `Invoice`, `InvoiceLine`, `Payment`, `PaymentAllocation`, `Refund`, `Receipt`, `DiscountApproval`, `CashSession`, `Expense`, `DailyClosing`, `LedgerEntry`.

**Inventory:** `Supplier`, `PurchaseOrder`, `GoodsReceipt`, `InventoryLot`, `StockMovement`, `StockAdjustment`, `ReorderRule`.

Entity names are provisional; an implementation discovery step should validate mandatory fields, relationships, legal record retention, invoice/tax rules, and clinical workflows before schema design.

`TreatmentPackage` is an MVP entity and must record package price, number of included sessions, sessions completed, sessions remaining, validity/expiry, assigned doctor and therapist, linked consumables, follow-up needs, and payment/outstanding balance. The session count and outstanding balance must be derived or transactionally maintained from their source records so they cannot silently diverge.

## MVP versus later releases

| Build in the first MVP | Deliberately defer until later |
| --- | --- |
| Nagpur single-clinic staff system; roles, permissions, authentication, audit logs | Advanced multi-location operations and branch-to-branch workflows |
| Patient records, consents, documents, and before/after photographs | Online patient booking and patient portal |
| Lead/enquiry capture, follow-ups, conversion, appointment and check-in workflows | WhatsApp automation and other external communication automation |
| Consultations/clinical records, treatment plans, packages, sessions, doctor/therapist assignment, and follow-up | Other external integrations |
| Package price, session count/completed/remaining, validity, consumables, assigned clinician/therapist, payment/outstanding status | Advanced/double-entry accounting, reconciliation, and accountant workflows |
| Basic billing, invoices, payments, refunds, receipts, outstanding balances | Tally, GST filing, and accountant integrations |
| Basic accounting: daily collections, cash/bank, payment modes, expenses, daily closing, and basic revenue/expense reports | Advanced reporting beyond essential operational/financial reports |
| Inventory, consumables, stock movement, and essential dashboard/reports |  |
| Security/privacy controls, backups, testing, CI/CD, monitoring, and deployment hardening |  |

## Security and privacy

- Treat all patient and clinical information as highly sensitive. Collect only what is necessary, display the minimum data needed for each role, and record every access/change to clinical and financial records.
- Enforce authorization on the server and use PostgreSQL privileges/row-level security as defense in depth where the deployment model supports it. Never rely on client-side authorization.
- Protect against OWASP web risks: input validation, parameterized queries, output encoding, CSRF protections, strict Content Security Policy, secure headers, rate limits, file-type/size scanning, and dependency/security scanning.
- Encrypt data in transit (TLS) and at rest; manage secrets through the deployment platform, not source control or `.env` files committed to Git.
- Encrypt/limit access to attachments, use short-lived signed URLs, and never expose public patient-document URLs.
- Maintain append-only audit events for authentication, role changes, record access, clinical signing/amendments, invoice/payment/refund actions, exports, and integrations.
- Define approval workflows and segregation of duties for refunds, price overrides, discounts, stock adjustments, and financial close-out.
- Obtain legal/privacy guidance for Indian health-data obligations, consent language, communication opt-in, record retention, and breach response before collecting production patient data. This plan is not legal advice.

## Development phases

### Phase 0 — Discovery and foundation decisions

Confirm detailed workflows, forms, data retention, tax/payment rules, staff count, reporting definitions, and legal/privacy requirements for the Nagpur MVP. Produce wireframes, a permission matrix, data dictionary, package/session rules, and acceptance criteria. Establish local/dev/staging/production environments.

### Phase 1 — Secure platform foundation

Scaffold the application; configure PostgreSQL migrations, staff authentication, permissions, audit logging, clinic settings, design system, error handling, test tooling, CI, and deployment baseline.

### Phase 2 — Front-office MVP

Deliver the first portion of the MVP journey: lead/enquiry capture and follow-up, patient registration/search/deduplication, appointment/calendar workflows, check-in, permitted staff-led communication history, and role-aware dashboard.

### Phase 3 — Clinical and treatment workflows

Deliver consultation records, consent/documents/before-after photographs, treatment plans, treatment packages, doctor/therapist assignment, treatment sessions, package session/validity tracking, consumable usage, follow-up, signing/amendment rules, and audit review.

### Phase 4 — Billing, payments, and inventory

Complete the MVP with catalog/pricing, package sales, invoices, receipts, payment allocation/refunds, outstanding balances, daily collections, cash/bank tracking, payment modes, expenses, daily closing, basic revenue/expense reports, inventory receiving/movement/consumption, and essential reports.

### Phase 5 — Hardening and operational launch

Run security review, performance/load testing, backup-restore rehearsal, staff training, data migration/import validation, pilot operation, and production cutover.

### Phase 6 — Extensibility releases

Add verified WhatsApp automation, patient online booking/portal, richer accounting/double-entry and reconciliation, Tally/GST/accountant integrations, advanced reporting, multi-location operations, and other integrations through the adapter/outbox boundary.

## Testing strategy

- **Unit tests:** domain services, permission decisions, money/tax calculations, validation, status transitions, and inventory invariants.
- **Integration tests:** database migrations, repositories, transactions, row/tenant constraints, and external-provider adapters using test doubles.
- **End-to-end tests:** critical role-specific journeys—lead to patient, booking to treatment, invoice to payment/refund, and staff/role administration.
- **Security tests:** authorization matrix regression tests, dependency scanning, secrets scanning, SAST, file upload tests, and periodic independent penetration testing before launch.
- **Accessibility and usability:** keyboard navigation, contrast, form error handling, responsive clinic-desk workflows, and user acceptance testing with each staff role.
- **Operational tests:** backup restoration, migration rollback/forward plans, error alerts, audit-log completeness, and load tests for concurrent reception activity.

Require automated linting, type checking, unit/integration tests, and relevant end-to-end smoke tests for every pull request. Staging approval and a production migration rehearsal are required for schema changes.

## Deployment approach

Use separate local, development/staging, and production environments. Deploy the Next.js application as containers or a managed Next.js runtime, with a managed PostgreSQL instance in the same region where feasible and private S3-compatible storage for attachments. Keep production database access private; use a connection pooler and least-privilege service accounts.

GitHub Actions should run quality checks, build an immutable artifact, deploy to staging, run smoke tests, and require explicit production approval. Apply database migrations as a controlled deployment step with backups and a documented rollback/forward strategy. Configure HTTPS, custom domain, monitored health checks, encrypted backups, log/error retention, and alerting from the first production release.

## Assumptions and decisions requiring confirmation

1. Which Indian privacy, clinical record-retention, and tax/GST rules apply, and who will supply approved consent/privacy wording before production data is collected?
2. What exact consultation, consent, prescription, treatment-plan, treatment-session, and before/after photograph templates and mandatory fields must be used?
3. What are the clinic's final invoice/GST settings, accepted payment modes, discount/refund approval limits, package cancellation/expiry policy, and daily-closing procedure?
4. Which inventory controls are mandatory at launch: batch/expiry tracking, barcode scanning, purchase orders, and supplier management?
5. Is there existing data to import, and who will validate its quality and approve the import?
6. What hosting/data-residency preference, domain, backup-retention period, recovery objectives, and production budget should govern deployment?
7. Is MFA mandatory for Admin and Doctor accounts at launch, and are shared reception terminals expected?
8. Who has final authority to approve the permission matrix, clinical templates, financial controls, production release, and ongoing data stewardship?

Implementation should begin only after these decisions are confirmed and Phase 0 outputs are accepted.
