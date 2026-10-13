// @autional/next 的中间件与 provider 都以 autional_token cookie 为会话凭据：
// 中间件按"cookie 是否存在"放行，provider 用 cookie 值播种 localStorage。
// SDK 本身只写 localStorage，因此由应用侧把 access token 同步进 cookie。
export const AUTIONAL_TOKEN_COOKIE = "autional_token";

export function setSessionCookie(token: string): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${AUTIONAL_TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/; SameSite=Lax${secure}`;
}

export function clearSessionCookie(): void {
  document.cookie = `${AUTIONAL_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
