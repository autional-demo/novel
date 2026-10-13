# AUTIONAL_CHANGES — what the onboarding changed in this fork

> Companion to `AUTIONAL_SETUP.md`. Full problem log: `AI-ONBOARDING-NOTES.md`.
> Date: 2026-10-13 · Branch: `feature/autional` · Upstream base: `fa95098e`

## Created

| Path                                          | Purpose                                                                                                              |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `apps/web/lib/autional.ts`                    | SDK config constants (appId / issuer / authorize pin / same-origin `/bff` resolver); notes C8, adaptation #2          |
| `apps/web/lib/autional-client.ts`             | Client-side SDK singleton accessor + `getClientAccessToken()` for fetches                                             |
| `apps/web/lib/session-cookie.ts`              | `autional_token` cookie write/clear (SameSite=Lax, Secure on https); notes C9                                         |
| `apps/web/lib/server-auth.ts`                 | Per-request Bearer verification via `/bff/identity/api/v1/auth/me` (revocation-aware); notes C8                       |
| `apps/web/lib/doc-store.ts`                   | Document store: private Blob (`docs/<uid>/<docId>.json`) + fs fallback; title derivation; ID validation               |
| `apps/web/middleware.ts`                      | Local cookie-presence gate — semantic equivalent of the SDK middleware; notes C7                                      |
| `apps/web/app/login/page.tsx`                 | Login page — SSO button (`loginWithOAuth`, authorize pinned), open-redirect-guarded `callbackUrl`, auto-replay SSO when a session-cookie trace exists (notes C12/C13 workaround) |
| `apps/web/app/oauth/callback/page.tsx`        | SSO callback — `handleOAuthCallback` → cookie write → guarded redirect; StrictMode-safe                               |
| `apps/web/app/api/docs/route.ts`              | `GET` list / `POST` create — Bearer gate first                                                                        |
| `apps/web/app/api/docs/[id]/route.ts`         | `GET`/`PUT`/`DELETE` one doc — Bearer gate + uid-scoped path (IDOR-safe); `PUT` never creates                         |
| `apps/web/components/session-cookie-sync.tsx` | Bridges provider auth events → cookie (READY/USER_CHANGED/TOKEN_CHANGED → set; LOGGED_OUT → clear); notes C9          |
| `apps/web/tests/doc-store.test.mts`           | Unit + fs round-trip tests (node:test, zero new deps) — 8/8 PASS                                                      |
| `apps/web/.env`                               | Public identifiers only (client_id / issuer / authorize) — no secrets; `.gitignore` exception documented there        |
| `AUTIONAL_SETUP.md` · `AUTIONAL_CHANGES.md`   | this wrap-up                                                                                                          |

## Modified

| Path                                             | Change                                                                                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/next.config.js`                        | rewrites `/bff/*` + `/.well-known/*` → `api.autional.cn` (same-origin proxy) — adaptation #1                                          |
| `apps/web/app/providers.tsx`                     | wrap app in `AutionalProvider` (config from `lib/autional.ts`) + `<SessionCookieSync />`                                             |
| `apps/web/app/page.tsx`                          | rewrite: SSO-guarded multi-document app (doc list, create/switch/delete, `?doc=` sync, debounced save status, derived titles)        |
| `apps/web/components/tailwind/advanced-editor.tsx` | controlled multi-doc editor: `initialContent` prop, lifted `saveStatus`, `onContentChange` debounce; localStorage autosave removed |
| `apps/web/components/tailwind/image-upload.ts`   | send `Authorization: Bearer` on upload                                                                                               |
| `apps/web/components/tailwind/generative/ai-selector.tsx` | custom `useCompletion` fetch injecting the Bearer header                                                                     |
| `apps/web/app/api/upload/route.ts`               | auth gate before Blob write                                                                                                          |
| `apps/web/app/api/generate/route.ts`             | auth gate before the (billable) generation call                                                                                      |
| `apps/web/package.json`                          | `@vercel/blob ^0.22.3 → ^2.8.1` (overwrite + private access; notes D7) · `test` script (node:test)                                   |
| `.gitignore`                                     | `.env` exception (public identifiers only) + `.data/` (local fs doc store)                                                           |
| `AI-ONBOARDING-NOTES.md`                         | problem log: C7-C13 (SDK), D7-D8 (toolchain/deps), S1-S6 (security), W5-W6 (upstream/toolchain)                                       |

## Deliberate deviations from the onboarding template

1. **Data model: single user → multi-document per user** (user decision; the template's simplest
   path would be one doc per user). Drives the list UI, `?doc=` routing, derived titles.
2. Browser calls go same-origin (`/bff` rewrites) — the API's CORS allowlist rejects unlisted
   origins, same as the exp-1 finding; production needs the same proxy shape (Vercel rewrites).
3. `authorizeUrl` pinned to the auth plane; region switch via env (adaptation #2).
4. Cookie bridging is app-side (notes C9) — the SDK has no cookie write path.
5. Server verification is app-side `/auth/me` per request (notes C8).
6. No passwords in any tracked file (public fork); credentials only in `provision/` (gitignored).
7. Documents are private blobs with token-derived user namespaces; image uploads stay public
   (editor requires renderable URLs) but are login-gated.
