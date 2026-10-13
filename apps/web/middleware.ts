import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// 本地实现（等价 @autional/next 的 autionalMiddleware 行为）。
// 原因：SDK 0.3.x dist 为单文件 bundle 且构建丢失 "use client"，
// 从 middleware（服务端图）引 @autional/next 会把 provider 里的 React hooks
// 带进 react-server 条件编译而报错。缺陷记录见 AI-ONBOARDING-NOTES C7。
// 语义：仅做 cookie 存在性门（与 SDK 一致），真伪由服务端 /auth/me 校验。

const TOKEN_COOKIE = "autional_token";
const NEXTJS_INTERNAL = ["/_next/", "/favicon.ico", "/api/auth/"];

function matchesPattern(pathname: string, pattern: string): boolean {
  if (pattern.endsWith("/:path*")) {
    const base = pattern.replace("/:path*", "");
    return pathname === base || pathname.startsWith(base + "/");
  }
  return pathname === pattern;
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (NEXTJS_INTERNAL.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const isPublic =
    matchesPattern(pathname, "/login") ||
    matchesPattern(pathname, "/oauth/callback") ||
    matchesPattern(pathname, "/api/:path*");
  if (isPublic) {
    return NextResponse.next();
  }

  if (!matchesPattern(pathname, "/")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
