# Skintech Clinic Management

Secure staff-platform foundation for Dr Dolly's Skintech Clinic, Nagpur. The current implementation is **Phase 1 only**: identity, authorization, audit foundations, database migrations, application shell, testing, and CI. It intentionally contains no patient, lead, appointment, clinical, treatment, billing, accounting, or inventory modules.

## Prerequisites

- Node.js 22 or later
- pnpm 10 or later
- PostgreSQL 16 or later

## Local setup

1. Copy `.env.example` to `.env` and replace the placeholder `DATABASE_URL` and `AUTH_SECRET`. Generate the secret with `openssl rand -base64 32`.
2. Create the local PostgreSQL database and least-privilege application user.
3. Install dependencies: `pnpm install`.
4. Apply committed migrations: `pnpm db:migrate:deploy`.
5. Seed roles, permissions, Dr Dolly's Skintech Clinic, Nagpur, and its initial Nagpur location: `pnpm db:seed`.
6. Start the application: `pnpm dev`.

The seed intentionally does **not** create a default administrator or password. To create the first Admin, set `ADMIN_EMAIL` and an Argon2 password hash in your local environment, then run `pnpm db:seed`. Generate the hash outside source control, for example with a local script that uses `argon2.hash()`.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start local development server. |
| `pnpm lint` | Run ESLint. |
| `pnpm format:check` | Check Prettier formatting. |
| `pnpm typecheck` | Generate Prisma client and run TypeScript checking. |
| `pnpm test` | Run unit and configured integration tests. |
| `pnpm test:e2e` | Run Playwright health-check smoke test. |
| `pnpm build` | Generate Prisma client and create production build. |
| `pnpm db:migrate:dev` | Create/apply a new development migration. |
| `pnpm db:migrate:deploy` | Apply already-committed migrations; use this in staging/production. |
| `pnpm db:seed` | Seed platform roles/permissions and Nagpur clinic foundation. |
| `pnpm db:studio` | Open Prisma Studio for local development only. |

## Database migration policy

All schema changes must be created as reviewed, committed Prisma migrations. Use `pnpm db:migrate:dev` locally, commit the generated migration, and apply it through `pnpm db:migrate:deploy` in CI/CD. Never use `prisma db push` against staging or production.

Before deploying a migration, take a verified backup, test it on staging, and have a forward/rollback procedure. Production database credentials and backups must be managed by the hosting platform, not committed to this repository.

## Security notes

- `.env` is ignored. Do not commit credentials, password hashes, API keys, or real patient data.
- Authentication uses staff credentials with Argon2 verification; authorization is checked server-side from role permissions.
- The application shell is protected at `/app`; `GET /api/health` is intentionally public and reveals no secrets.
- Audit-event persistence is available for future module services; all material record changes must use it.
- Content-security and basic security headers are set in `next.config.ts`.

## CI

GitHub Actions starts ephemeral PostgreSQL and runs committed migrations, linting, type checking, tests, production build, and the Playwright health smoke test on pushes to `main` and pull requests.
