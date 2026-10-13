# Autional Integration — Novel (fork)

## Basics

- Date: 2026-10-13
- Framework: Next.js 15.1.4 (App Router) + React 18 · Tiptap WYSIWYG · AI SDK v3 · Tailwind · pnpm workspace + turbo
- Tenant: novel-demo (trial, expires **2026-10-20**)
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

| Portal    | Address                       | Purpose                                     |
| --------- | ----------------------------- | ------------------------------------------- |
| Admin     | https://admin.autional.cn     | users / roles / security policy / audit log |
| User      | https://user.autional.cn      | change password / devices / MFA             |
| Security  | https://security.autional.cn  | anomaly detection / login trends            |
| Developer | https://developer.autional.cn | API docs / OAuth clients / app settings     |
| Status    | https://status.autional.cn    | service health                              |

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
9. **Session-expiry recovery** (notes C12/C13): the SDK never refreshes on boot (expired access
   token → session dropped, refresh token unused) and its Next.js provider overwrites
   localStorage session data from the cookie on every load. Workaround: `/login` auto-replays
   the SSO redirect when a session-cookie trace exists — with the IdP session alive (the common
   case) the user returns to the app without any click. Access-token TTL is 300 s.

## Deploying to Vercel

1. Create the Vercel project for `apps/web` (repo root = monorepo, set root directory).
2. Environment variables:
   - `NEXT_PUBLIC_AUTIONAL_APP_ID` = `client-cXHzN7C6YN7Y`
   - `NEXT_PUBLIC_AUTIONAL_ISSUER` = `https://api.autional.cn`
   - `NEXT_PUBLIC_AUTIONAL_AUTHORIZE_URL` = `https://auth.autional.cn/oauth/api/v1/oauth/authorize`
   - `BLOB_READ_WRITE_TOKEN` = from a Vercel Blob store (docs are private; images public)
   - `OPENAI_API_KEY` = optional, enables the AI autocomplete feature
3. Register the production callback in the OAuth client: `https://<domain>/oauth/callback`
   (and add the origin to the client's CORS list).
4. Check tenant trial expiry (**2026-10-20**) before relying on the deployment.

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
