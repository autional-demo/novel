import { getAutionalApiUrl } from "./autional";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
}

// 服务端逐请求验证：Bearer token → /auth/me（权威校验，能感知吊销；/bff 前缀必需）
export async function verifyAccessToken(
  authorization: string | null,
): Promise<AuthUser | null> {
  const token = authorization?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  try {
    const res = await fetch(`${getAutionalApiUrl()}/identity/api/v1/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { id?: string; username?: string; email?: string };
    };
    const data = json?.data;
    if (!data?.id) return null;
    return {
      id: String(data.id),
      username: String(data.username ?? ""),
      email: String(data.email ?? ""),
    };
  } catch {
    return null;
  }
}
