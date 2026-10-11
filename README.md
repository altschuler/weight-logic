# Weight Logic

A private weight and food-mass journal, deployed at **https://weightlogic.app**.
Behavior is specified in [PRODUCT_SPEC.md](PRODUCT_SPEC.md); delivery progress is in [plans/README.md](plans/README.md).

## Run locally

Requires Node 24 and pnpm 10 (`packageManager` pins the version).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://localhost:5173**. Enter any test email address and open the development sign-in link shown on the page. This exercises real Better Auth verification without sending email. Local development needs no Cloudflare or Resend credentials. Use `localhost`, not `127.0.0.1`, for the configured auth origin.

Vite serves port 5173 and proxies `/api` to the local Worker on 8787. Alchemy runs local D1 and SQLite Durable Objects with data under `.alchemy/local/`. Never expose this development server publicly: its inbox intentionally exposes development login links. Production disables that endpoint and removes its UI.

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm exec playwright install chromium   # once per machine
pnpm test:e2e
pnpm build
```

The E2E suite starts the local stack if necessary and tests desktop and mobile Chromium. It creates disposable local accounts, captures screenshots in `.amp/in/artifacts/`, and retains traces on failure. Mobile emulation is not a real-device Safari test.

### Local demo journals

With `pnpm dev` running in another terminal, choose a journal:

```sh
pnpm seed steady
pnpm seed plateau
```

Each command restores 56 days through local today and prints a fresh single-use sign-in URL (valid for 10 minutes). Open that URL to explore the seeded journal. `steady` shows gradual loss with natural fluctuations; `plateau` shows initial loss followed by a month-long plateau and a replan six days ago. Both include missing weigh-ins, realistic named meals with gram masses and explicit before/after-evening periods, and acknowledgements on older days. Values are deterministic relative to today, so rerunning on the same day restores the same data.

**Rerunning replaces only the chosen dedicated demo journal:** `demo-steady@example.test` or `demo-plateau@example.test`. Do not use these accounts for personal data. The script is fixed to `http://localhost:5173`, requires the development inbox, verifies the authenticated account, and uses real magic-link authentication plus the tracker restore API—not direct database access. There is no production URL or arbitrary-account option. After restore it reads back, validates, and compares the saved dataset, then reports counts and progress before generating your unused login link.

## Small architecture

- `packages/domain`: shared Effect schemas, exact rational arithmetic, calendar dates, and pure dataset transitions. Canonical weights are kilograms, meals are grams; strings preserve exact decimals and fractions in backups.
- `src/server`: Better Auth/D1, Resend delivery, session-protected API, and one SQLite Durable Object per auth user ID. The client cannot select another owner.
- `src/components`: React with shadcn's Radix Rhea components. The chart, date inspector, and food budget share the same trajectory calculation.
- `alchemy.run.ts`: one Worker with static assets, the auth D1 database, the tracker DO binding, and the `weightlogic.app` custom domain.

Tracking data is a versioned dataset stored atomically in a single SQLite row in each user's DO. This keeps corrections and backup replacement simple and transactional. The current **1.5 MB per-journal limit** stays below SQLite's row limit; oversized changes are rejected without changing stored data. Export a backup regularly. There is no offline editing, live multi-tab synchronization, or medical guidance.

## Deploy

Keep these values in the ignored, permission-restricted `.env` file, never in Git or client-side `VITE_*` variables:

```dotenv
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
RESEND_API_KEY=...
BETTER_AUTH_SECRET=...
```

Use a stable, cryptographically random auth secret of at least 32 characters. The initial production secret is already generated and saved locally. Cloudflare stores it and the Resend key as secret bindings. The sender is `Weight Logic <signin@weightlogic.app>`.

```sh
# Review the production plan without changing resources:
node --env-file=.env node_modules/alchemy/bin/cli.js deploy --stage production --dry-run --yes --no-input

# Build and deploy:
pnpm run deploy --no-input
```

Use **`pnpm run deploy`**, not `pnpm deploy` (the latter is pnpm's unrelated built-in command). Node explicitly loads `.env` because this Alchemy release's stack uses `process.env`. Alchemy is pinned to `2.0.0-beta.81` with Effect `4.0.3`; upgrade together deliberately.

### State and recovery

**Preserve and securely back up `.alchemy/state/` and `.env`.** Infrastructure state is local, not shared remotely, and must accompany deployment ownership if moving machines. Do not deploy from a fresh state directory, change resource logical IDs, use `--adopt`, or run a destroy command casually. `.alchemy/local/` contains only local app data; production data lives in Cloudflare. Secrets and state are deliberately excluded from Git.

Initial production resources (2026-10-11):

| Resource | Identity |
| --- | --- |
| Stack/stage | `weightlogic` / `production` |
| Worker | `weightlogic-app-production-m2otmcmc3inkh44t` |
| D1 | `weightlogic-Auth-production-ehoco6l76hdztb2a` |
| D1 ID | `8e5f328b-6391-4030-9c81-4362bbcb5fe0` |
| DO class/binding | `Tracker` / `TRACKERS` |
| Custom domain | `weightlogic.app` |

Add forward-only numbered SQL files in `migrations/` for auth schema changes; Alchemy applies them to D1. Tracker schema changes require an explicit version migration in the domain/DO boundary. Test migrations against disposable local data first, and back up production before transformations. Re-deploying older code is a code rollback, **not** a database rollback; old code must still understand stored data. User exports can be restored through Settings after confirmation; invalid backups never replace existing data. Clearing tracking data keeps the auth account.

## Release verification and caveats

- 14 domain tests and 12 desktop/mobile browser tests passed, plus typecheck, lint, and production build.
- Live HTTPS smoke checks passed for magic-link redemption, secure cookies, goal creation, measurements, meals, reload persistence, sign-out, single-use enforcement, and disabled local inbox. A disposable verification record was seeded through administrative D1 access to avoid email; no auth bypass exists in the application. The synthetic tracker was cleared and its auth records removed afterward.
- Expiry rejection was tested by expiring a disposable local D1 verification record. Concurrent redemption was tested with two independent browser contexts; exactly one obtained a session.
- Existing Resend DNS records were preserved. The owner's setup email arrived **in spam**. No new production email was sent during implementation, so fresh delivery and inbox placement are not verified. The sign-in page tells users to check spam.
- Reload persistence was exercised locally and in production. Full machine-restart recovery and real-device Safari were not separately tested.
