# Weight Logic implementation progress

Plan created and implemented 2026-10-11. The application is live at https://weightlogic.app. Code is committed locally; no Git remote is configured and nothing has been pushed.

Execute [001-web-application.md](001-web-application.md) in order. Update this table and the setup checklist as work completes. Do not mark deployment complete based on local verification.

| Stage | Outcome | Status |
| --- | --- | --- |
| 1 | Connect Cloudflare and Resend for direct Alchemy provisioning | DONE |
| 2 | Local Effect/React/Cloudflare stack and authenticated account boundary | DONE |
| 3 | Tested calculation engine, durable storage, and API | DONE |
| 4 | Complete mobile-first Rhea UI | DONE |
| 5 | Verified production deployment at https://weightlogic.app | DEPLOYED — authenticated smoke passed; fresh email delivery unverified |

## Setup checklist

- [x] Set access model: owner approved full account access, superseding resource-scoped bootstrap.
- [x] Owner saves dedicated Cloudflare API token and account ID in local secret configuration.
- [x] Verify token and target account without exposing credentials: account-owned token active; zone active in selected account.
- [x] Inspect existing weightlogic.app DNS/domain connections: three email-related records; no apex record, Worker routes, or Worker custom domains. No changes made.
- [x] Protect local secrets with repository-local Git excludes; credentials loaded only by verification processes, never printed.
- [x] Prepare pinned Alchemy configuration and provision Weight Logic resources directly.
- [x] Record non-secret resource IDs and establish persistent Alchemy state ownership: local `.alchemy/state/`, retained on this machine; see root README.
- [x] Configure sending-only Resend key and verify sender: owner confirmed delivery, but message landed in spam. Key's domain restriction remains unverified; no broader permission is needed.
- [x] Complete owner credential setup; no further credentials currently needed.
- [x] Confirm production setup is ready for unattended implementation and release.

## Current handoff

Cloudflare read-only connectivity checks passed. Existing DNS records are rsend.weightlogic.app and send.weightlogic.app CNAMEs plus resend._domainkey.weightlogic.app TXT; preserve all three. No existing website connection was found.

RESEND_API_KEY is already configured. Resend rejected domain listing with restricted_api_key because the key is sending-only; do not broaden it merely to inspect domains. The key's domain restriction has not been verified. The owner authorized one setup-test email to simon@seealso.co from Weight Logic <signin@weightlogic.app>. Resend accepted it with HTTP 200, email ID 01a12b48-01b2-7407-bd42-1f3454dd6e9a. Idempotency key: weightlogic-setup-T-01a12b28-84c5-7613-b6fe-c9e04f2cbdfd-1. Owner confirmed receipt in spam and accepted proceeding. Do not resend automatically.

Launch concern: sender works, but inbox placement is not verified. Before release, inspect public email-authentication DNS and, if supplied, delivered-message authentication results; do not assume a cause or promise inbox placement. Use production magic-link content for the later authorized delivery test and include spam-folder guidance in the sign-in UI. This does not block local implementation or infrastructure setup.

Implementation and deployment completed. Alchemy 2.0.0-beta.81 / Effect 4.0.3; pnpm workspace separates shared pure domain logic from the app. A D1 auth database, Worker, SQLite DO binding, and apex custom domain are provisioned. Existing email DNS records remain unchanged. Deployment commands, resource IDs, persistence limits, and recovery guidance are in [the runbook](../README.md).

Alchemy will handle provisioning; the owner-run bootstrap restriction has been withdrawn. Full access is not authorization to mutate unrelated resources.

Verification: 14 domain tests and 12 desktop/mobile Playwright tests pass, along with typecheck, lint, and build. Rendered journal, negative budget, history, settings, and replan states were inspected. Mobile history overflow was corrected and the assertion strengthened. Production smoke tested HTTPS login, secure cookies, goal creation, weigh-ins, meals, reload persistence, responsive rendering, sign-out, single-use tokens, and disabled development inbox. Disposable production auth records were removed and the test tracker cleared. Expiry rejection and concurrent redemption passed against local Worker/D1. Full machine restart and real-device Safari were not separately tested.

No implementation-test emails were sent. Production auth smoke used a disposable, administratively seeded verification record rather than a public bypass. The earlier spam placement remains unresolved; fresh Resend delivery was not exercised. Local preview remains at http://localhost:5173 with development-only magic links.

## UI simplification and local demos

Removed decorative copy, icons, repeated explanations, and nested cards. The journal uses one column; calculation details, meal-period totals, and historical records expand on demand. Kept all accounting and correction behavior. Added `pnpm seed steady` and `pnpm seed plateau`, each loading a dedicated local account with 56 days and 206 meals. Both seed roundtrips were verified, populated desktop/mobile screens inspected, and all 14 domain / 12 browser tests, typecheck, lint, and build passed. Demo data is never loaded into production.
