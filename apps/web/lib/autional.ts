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
