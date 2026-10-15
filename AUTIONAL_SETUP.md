# Autional Integration — Novel (fork)

## Basics

- Date: 2026-10-13
- Framework: Next.js 15.1.4 (App Router) + React 18 · Tiptap WYSIWYG · AI SDK v3 · Tailwind · pnpm workspace + turbo
- Tenant: novel-demo (permanent since 2026-10-14 — trial=false, no expiry)
- Tenant slug: `novel-demo`
- Region: **.cn** (all planes: issuer/api `api.autional.cn`, auth `auth.autional.cn`)
- Environment: local dev (`http://localhost:3000`), Vercel-ready

## Configuration

- App ID: `client-cXHzN7C6YN7Y` — registered public OAuth client
  (`redirect_uri` = `http://localhost:3000/oauth/callback`; CORS origin `http://localhost:3000`)
- Issuer: `https://api.autional.cn`
- API URL: `https://api.autional.cn/bff` — the gateway routes only `/bff/<svc>/...`
- Authorize (SSO): pinned to `https://auth.autional.cn/oauth/api/v1/oauth/authorize`
  — in proxy form the SDK derives a same-origin authorize URL that lands on the API plane (no login UI), see notes C7-adjacent adaptation #3
- Tenant ID: `01M4THMP5B6QHRFPHJH6JCRJQ7` — supplied per login call
- Admin: `novel+admin@autional.net`

## Security policy (tenant settings)

- Password transmission: **hash** — `sha256hex(password + "|" + tenantId)`
- Public trial registration (no invitation code), rate-limited per client_ip

## Test accounts

| Account     | Role      | Password                                          |
| ----------- | --------- | ------------------------------------------------- |
| novel-alice | test user | delivered separately — never written to this repo |
| novel-bob   | test user | delivered separately                              |
| novel-carol | test user | delivered separately                              |

> This fork is public: no password appears in any tracked file. Credentials live
> outside the repository, local machine only (`D:\ws\ai-onboarding-lab\provision\`).

## Portals

| Portal    | Address                                | Purpose                                     |
| --------- | -------------------------------------- | ------------------------------------------- |
| Admin     | https://admin.autional.cn/novel-demo/  | users / roles / security policy / audit log |
| User      | https://user.autional.cn/novel-demo/   | change password / devices / MFA             |
| Security  | https://security.autional.cn/novel-demo/ | anomaly detection / login trends          |
| Developer | https://developer.autional.cn          | API docs / OAuth clients / app settings (global) |
| Status    | https://status.autional.cn             | service health (global)                     |

> Console portals are tenant-scoped — the `/novel-demo/` slug keeps users on the tenant. A bare root drops them on the tenant picker.

## Integration adaptations (vs. the onboarding template)

1. **Same-origin `/bff` reverse proxy.** Browser traffic never crosses origins:
   `next.config.js` rewrites `/bff/:path*` and `/.well-known/:path*` → `api.autional.cn`.
   Browser-side `apiUrl` = `window.location.origin + "/bff"`; server-side = absolute issuer URL.
2. **`authorizeUrl` pinned to the auth plane** (`lib/autional.ts`). In proxy form the SDK's
   default same-origin authorize URL has no login UI. Overridable via
   `NEXT_PUBLIC_AUTIONAL_AUTHORIZE_URL` for other regions.
3. **Session cookie bridge** (`components/session-cookie-sync.tsx`). `@autional/next` reads an
   `autional_token` cookie (middleware + provider seed) but no SDK package ever writes it
   (notes C9). The app subscribes to provider auth events and writes/clears the cookie itself.
   The cookie is a UX gate only — the server never trusts its contents.
4. **Local middleware** (`middleware.ts`) re-implements the SDK middleware semantics
   (cookie-presence gate, `protectedPaths=['/']`) because importing `@autional/next` from the
   server graph fails to compile (notes C7). Drop-in replaceable once the SDK ships fix.
5. **Server-side verification** (`lib/server-auth.ts`) calls
   `/bff/identity/api/v1/auth/me` per request (revocation-aware). The SDK server helper's
   `authUrl` semantics vs. the mandatory `/bff` prefix are undocumented (notes C8).
6. **Display name via `/auth/me`** — OAuth `userinfo` returns only `{sub, client_id, scope}`
   (notes C10).
7. **Storage**: documents = **private** Vercel Blob (`docs/<userId>/<docId>.json`), userId always
   derived from the verified token; local dev without `BLOB_READ_WRITE_TOKEN` falls back to
   `.data/` on disk (gitignored). Uploaded images = public blobs (editor `<img>` needs them),
   gated by login.
8. **All app APIs are gated**: `/api/docs*`, `/api/upload`, `/api/generate` verify the Bearer
   token before any work (notes S1/S5).
9. **Session-expiry recovery** (notes C12/C13, **fixed 2026-10-15**): `@autional/core` 0.3.5
   refreshes an expired access token on boot (refresh token present → refresh, then hydrate);
   `@autional/next` 0.4.0 no longer overwrites a rich localStorage session with the cookie seed.
   A reload past the 300 s access-token TTL recovers silently — no SSO replay, no forced login
   (C6N probe 12/12, local + production 2026-10-15). The former `/login` auto-replay workaround has been removed.

## Deploying to Vercel

**Current deployment (novel-demo):** private Vercel project, **Git-connected** to
`github.com/autional-demo/novel` (2026-10-13, Vercel GitHub App). Push to `main` →
automatic production deployment; other branches → preview deployments. Root Directory =
`apps/web`, Production Branch = `main`.

**CLI deploy** (from the repo root; monorepo upload) also works:

```bash
pnpm dlx vercel --prod        # link on first run; re-deploys current working tree
```

Optional monorepo note: set "Ignored Build Step" to skip builds when `apps/web/**`,
`packages/**`, `pnpm-lock.yaml` are unchanged.

### Environment variables (all already set on novel-demo)

- `NEXT_PUBLIC_AUTIONAL_APP_ID` = `client-cXHzN7C6YN7Y`
- `NEXT_PUBLIC_AUTIONAL_ISSUER` = `https://api.autional.cn`
- `NEXT_PUBLIC_AUTIONAL_AUTHORIZE_URL` = `https://auth.autional.cn/oauth/api/v1/oauth/authorize`
- `BLOB_READ_WRITE_TOKEN` = private docs store (Vercel Blob, private access)
- `IMAGES_BLOB_READ_WRITE_TOKEN` = public images store (separate store; access modes are
  mutually exclusive per token — notes D7/S4)
- `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` = AI completions via the Autional
  relay (gateway on `api.autional.cn`); not the upstream default OpenAI endpoint

### One-time platform steps

1. Register the production callback in the OAuth client: `https://<domain>/oauth/callback`
   (and add the origin to the client's CORS list) — done via `provision/novel-update-client.mjs`.
2. Tenant `novel-demo` is permanent since 2026-10-14 (`trial=false` / `trial_expires_at=NULL`) —
   no expiry action needed.

## Running locally

```bash
pnpm install
pnpm --filter novel-next-app dev     # http://localhost:3000
pnpm --filter novel-next-app test    # doc-store unit tests (node:test, no ext. deps)
pnpm --filter novel-next-app build
```

## Verification records

| What                    | Where                                   | Result                                                |
| ----------------------- | --------------------------------------- | ----------------------------------------------------- |
| SSO end-to-end (browser)| live run 2026-10-13                     | authorize → consent → callback → session → logout ✅   |
| Multi-doc E2E (browser) | live run 2026-10-13                     | create / switch / reload-persist / logout / user isolation ✅ |
| Auth + IDOR probes      | `provision/novel-probe-idor.mjs`        | **19/19 PASS** (cross-user 404 both ways; 401 gates)  |
| Unit tests              | `apps/web/tests/doc-store.test.mts`     | **8/8 PASS**                                          |
| SDK bump + C6N closed loop (2026-10-15) | `provision/novel-c6n-refresh-e2e.mjs` (local + production) | local **12/12** · production **12/12** (synthetic-expiry reload → silent refresh expIn≈296s; no login bounce; rich session kept; cookie bridge updated) |
