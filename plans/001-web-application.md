# Implement Weight Logic as an Effect-based web application

## Requirements and settled decisions

- PRODUCT_SPEC.md is the behavioral source of truth. Implement its entire scope, including model limitations, historical corrections, portability, and privacy.
- Deploy the finished application at https://weightlogic.app. The owner authorized deployment and subsequently approved full Cloudflare account access to simplify setup. This does not authorize unrelated mutations or destructive changes to conflicting existing services.
- Use Alchemy for infrastructure; Cloudflare Workers for the server; one SQLite-backed Durable Object per authenticated user for the complete tracker; D1 for Better Auth data.
- Use Better Auth email magic links, with Resend for production email. No Google login. The domain is registered through the owner's Cloudflare account and already configured in Resend; verify current DNS and sender status before changes.
- Use TypeScript and Effect wherever applicable: server workflows, services, external operations, typed errors, dependency injection, and Effect Schema validation. Keep deterministic domain calculations pure and React rendering idiomatic.
- Use React/Vite and shadcn Rhea. Mobile usability is mandatory, including touch input, phone keyboards, charts, dialogs, and data-management screens.
- Defaults proposed in the conversation: public self-service magic-link signup, one private tracker per account, no offline editing in v1. Surface changes to these assumptions rather than silently expanding scope.
- Do not add calorie tracking, medical advice, social features, wearables, smoothed forecasts, or other features excluded by the spec.

## Current state and verification contract

There is no existing implementation, package manifest, test command, or Git commit. Node 24 and pnpm are available; Bun was not found. Prefer pnpm unless installed dependency compatibility requires otherwise. Inspect current repository guidance before implementation.

During scaffolding, establish and document these scripts (these are planned commands, not existing or verified commands):

| Command | Required result |
| --- | --- |
| pnpm dev | Local frontend, Worker, D1 and SQLite DO runtime; persistent local data; no cloud calls |
| pnpm typecheck | No type errors |
| pnpm lint | No lint errors |
| pnpm test | Domain and local-runtime integration suites pass |
| pnpm test:e2e | Browser journeys pass against local runtime |
| pnpm build | Production assets and Worker build successfully |

Pin a compatible Alchemy/Effect toolchain after a small compatibility check; current Alchemy documentation uses Effect RC packages. Do not mix examples from incompatible Alchemy releases. Use the selected version's actual commands in the final runbook.

## Stage 1 — Connect Cloudflare and Resend with the owner

Updated decision: the owner explicitly approved full Cloudflare access, replacing the resource-scoped token and owner-run bootstrap requirement. Guide the owner one action at a time. Use a dedicated revocable account API token, not the global API key. Never ask for secrets in chat. Alchemy manages resources but is not a security boundary on the token.

The owner saves CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in local secret configuration, preserving existing entries. Verify token validity and target account without printing credentials. Inspect weightlogic.app DNS and existing services before provisioning; preserve Resend records and stop for approval on conflicts. Broad access permits the necessary inspection, not unrelated modifications.

Prepare pinned Alchemy configuration declaring the app Worker, user-tracker DO binding, auth D1 database and custom domain. The agent can now provision these directly; no separate owner-run bootstrap is required. Choose persistent infrastructure state storage explicitly, retain stack identity, record non-secret resource IDs, and prevent unintended resource replacement. Bind only Weight Logic resources. Do not expose an unfinished public API.

Protect local credentials and state from Git. Repository-local excludes now protect .env variants, .dev.vars variants, .alchemy and .amp/in; add durable project ignore rules when scaffolding. Preserve the existing user-owned .env without printing values. Configure a sending-only Resend key restricted to the verified domain where supported. Proposed sender: Weight Logic <signin@weightlogic.app>. Generate a production Better Auth secret securely, separate from development secrets.

Verification: authenticate to the selected account, inspect domain configuration, verify Alchemy provisioning and retained state, and confirm Resend sender readiness. Do not exercise permissions against unrelated resources. Tightening or revoking the dedicated deployment token remains possible later.

## Stage 2 — Scaffold the local stack and authenticated boundary

Create a small single-app repository with frontend, Worker, pure domain logic, schemas, tests, and Alchemy configuration. Avoid unnecessary workspaces or service layers. Establish the scripts above and dependency lockfile.

Run all application resources locally through Alchemy's supported local Cloudflare runtime. Keep cloud-only domain resources and remote state providers out of local reconciliation. Confirm local data survives restarts and that no production bindings are used.

Better Auth stores users, accounts, sessions, and verification records in D1. Implement magic-link authentication with local-only email capture and real verification during development, Resend in production, hashed short-lived single-use tokens, trusted origins/redirects, secure cookies, generic responses, and effective throttling. Do not log production tokens or email links. Verify concurrent token redemption against the chosen D1 adapter rather than assuming atomicity.

Every tracker request must verify the session and derive the DO identity from the stable auth user ID. Never accept a client-selected owner ID. Export no unauthenticated DO access route. Validate request bodies using Effect Schema and return deliberate typed errors without exposing internal details.

Verification: real local signup/signin/signout, expired and reused links, concurrent redemption, restart persistence, unauthenticated rejection, and two-user isolation. Run typecheck, lint, build, and targeted integration tests.

## Stage 3 — Implement calculations, storage, and API

Keep pure calculations independent of Workers, SQL, and React. Use calendar dates rather than elapsed milliseconds. Resolve today from the user's local calendar while preserving historical date strings. Validate client-provided date/timezone context instead of using the server's timezone. Store precise canonical physical quantities; choose decimal/rational arithmetic deliberately so fractional unit conversions and trajectory divisions do not round intermediate values. Presentation rounding must never change persisted values.

Implement all PRODUCT_SPEC.md rules: dated goals with dynamic baseline resolution; maintenance after deadline; distinct measured and planned weights; meal period classification; morning-weight prerequisite; evening reset accounting; removal/correction behavior; strict greater-than-100g deviation threshold; persistent acknowledgement; explicit same-day goal replacement and replanning; signed rates; progress statistics excluding future measurements.

The user DO owns daily records, meals, goals, preferences and acknowledgements. Use versioned SQL migrations and transactional mutations. Ensure concurrent requests do not lose edits or permit partial operations across async boundaries. Compute derived results from source data so historical corrections propagate correctly.

Add versioned complete tracker export, strict full-backup validation, confirmation-gated atomic replacement, and confirmed tracker clearing. Backups exclude credentials and sessions. Invalid/incomplete imports must leave existing data unchanged. Clearing tracking data preserves the account.

Verification: translate the spec's acceptance examples into behavior tests. Include DST, leap dates, both sides of deviation thresholds, fractional quantities, unit round trips, evening removal, baseline corrections, same-day goal replacement, gain/maintenance, expired deadlines, concurrent edits and rollback of invalid imports. Use asymmetric inputs and independent expected values. Run domain and actual local-runtime API tests.

## Stage 4 — Deliver mobile-first product UI

Implement Rhea-based screens for authentication, initial goal setup, today's tracker, history/projections, goal changes/replanning, units, export/restore and confirmed clearing. Use existing design skills during UI implementation. Maintain distinct gross and remaining budgets, meal totals/periods, actual/planned values, missing data and measurement dates.

Show previews before goal changes, do not mutate until acceptance, and never replan a historical date just because it is being viewed. Label loss, gain, and maintenance accurately. State that food-mass accounting is not calorie accounting or a safe eating prescription. Negative budgets must not encourage fasting or compensation.

Design narrow-screen navigation and forms first. Provide appropriate decimal keyboards, touch targets, readable chart alternatives, accessible labels, keyboard behavior, and recoverable pending/error states. Do not make offline edits appear saved.

Verification: browser journeys for the worked example, historical correction, replan acceptance/cancellation, restore rejection/success, and units. Inspect screenshots at mobile and desktop widths including non-default states, dialogs, errors and negative budgets. Check no page-level horizontal overflow and that charts/forms remain usable. Use synthetic test data in review artifacts.

## Stage 5 — Release to weightlogic.app and verify production

Run all established checks and local browser journeys. Verify privacy boundaries, backups, persistence, authentication abuse controls, schema migration paths, and production build. Inspect rendered mobile and desktop results; screenshots alone are not behavioral verification.

Deploy with Alchemy using the authorized account credentials and preserved stack state. Production deployment is authorized; unexpected destructive changes, unrelated DNS changes, Git pushes, and publication outside that authorization require separate approval. Review migration effects and back up any non-disposable data before writes; seek approval before destructive transformations.

Verify HTTPS at https://weightlogic.app, same-origin API/auth routing, real Resend delivery to an owner-approved recipient, login/logout, persistent tracker data, and a disposable-account smoke test. Confirm production never uses local email capture. Test responsive flows against the deployed build.

Document exact local and deployment commands, secret names (never values), resource IDs, state location, migration procedure, backup/recovery, and rollback limitations. Code rollback must not assume schema rollback is safe.

Done means the app is live on weightlogic.app and the production checks pass. Report commits/push status separately and honestly. If permissions block release, mark stage 5 BLOCKED, not DONE.

## Reference documentation

- https://alchemy.run/cloudflare/setup/
- https://alchemy.run/cloudflare/local-development/
- https://developers.cloudflare.com/workers/authorization/workers/
- https://developers.cloudflare.com/workers/authorization/durable-objects/
- https://www.better-auth.com/docs/plugins/magic-link
- https://ui.shadcn.com/docs/changelog/2026-05-rhea

Recheck version-dependent APIs and permission support at implementation time.
