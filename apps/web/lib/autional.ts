// 公开客户端配置：appId 即 OAuth client_id，属公开标识（无密钥）。
export const AUTIONAL_APP_ID =
  process.env.NEXT_PUBLIC_AUTIONAL_APP_ID ?? "client-cXHzN7C6YN7Y";

export const AUTIONAL_ISSUER =
  process.env.NEXT_PUBLIC_AUTIONAL_ISSUER ?? "https://api.autional.cn";

export const AUTIONAL_CALLBACK_PATH = "/oauth/callback";

// 反代形态下 SDK 无法推导登录页（默认把 authorize 指到同源），必须显式引脚到 auth 域。
// 换区部署（如 .com）用 NEXT_PUBLIC_AUTIONAL_AUTHORIZE_URL 覆盖。
export const AUTIONAL_AUTHORIZE_URL =
  process.env.NEXT_PUBLIC_AUTIONAL_AUTHORIZE_URL ??
  "https://auth.autional.cn/oauth/api/v1/oauth/authorize";

// 浏览器走同源反代 /bff（next.config.js rewrites → api.autional.cn）；服务端直连绝对地址。
export function getAutionalApiUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/bff`;
  }
  return `${AUTIONAL_ISSUER.replace(/\/+$/, "")}/bff`;
}

// ── 登出（OIDC RP-Initiated Logout 1.0 / end_session_endpoint）───────────────
// 标准端点（API 域，服务端已实现，E9 勘误实测活）：
//   https://api.autional.cn/oauth/api/v1/oauth/logout
// 登出必须整页跳转（浏览器导航，Accept: text/html）—— 服务端对浏览器导航与
// XHR 分支语义不同（浏览器无会话 → 302 确认页；XHR → 401）。SDK logout() 只清
// 本域，不终结 OP 会话；终结 OP 会话 = 跳本端点。
export const AUTIONAL_LOGOUT_PATH = "/oauth/api/v1/oauth/logout";

/** 读 localStorage 持久化载荷里的 idToken（best-effort）。
 *  SDK ≥0.3.3 落存 idToken；更早版本无此字段 / 刷新后载荷被 cookie 播种覆盖 → undefined。
 *  过期或解码失败一律省略（过期 hint 服务端 400 拒绝）。 */
function readStoredIdTokenHint(): string | undefined {
  try {
    const raw = window.localStorage.getItem("autional_tokens");
    if (!raw) return undefined;
    const idToken = (JSON.parse(raw) as { idToken?: unknown }).idToken;
    if (typeof idToken !== "string" || !idToken) return undefined;
    // JWT payload 为 base64url；exp 为秒级 Unix 时间。
    const base64 = idToken.split(".")[1] ?? "";
    const payload = JSON.parse(atob(base64.replace(/-/g, "+").replace(/_/g, "/"))) as {
      exp?: unknown;
    };
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) return undefined;
    return idToken;
  } catch {
    return undefined;
  }
}

/** state：随机 URL-safe 串（服务端原样回拼到回跳 URL）。 */
function generateLogoutState(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** 构造标准登出 URL（整页跳转用）。必须在 SDK logout() 之前调用 —— logout 清空本地载荷。 */
export function buildStandardLogoutUrl(): string {
  const endpoint = `${AUTIONAL_ISSUER.replace(/\/+$/, "")}${AUTIONAL_LOGOUT_PATH}`;
  const params = new URLSearchParams();
  const hint = readStoredIdTokenHint();
  if (hint) params.set("id_token_hint", hint);
  // post_logout_redirect_uri 须在客户端 post_logout_redirect_uris 注册白名单内；
  // 未注册服务端忽略并落 JSON（不开放重定向）。
  params.set("client_id", AUTIONAL_APP_ID);
  params.set("post_logout_redirect_uri", `${window.location.origin}/`);
  params.set("state", generateLogoutState());
  return `${endpoint}?${params.toString()}`;
}
